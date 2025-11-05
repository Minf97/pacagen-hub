#!/bin/bash

# =====================================================
# Blue-Green Deployment Script
# =====================================================
# This script implements zero-downtime deployment using
# Blue-Green strategy with health checks and rollback
#
# Usage: ./scripts/deploy-blue-green.sh
# =====================================================

set -e  # Exit on error

# Configuration
PROJECT_DIR="$HOME/pacagen-hub"
COMPOSE_FILE="docker-compose.prod.yml"
PROJECT_NAME="pacagen"  # Fixed project name to avoid container name conflicts
HEALTH_CHECK_TIMEOUT=30
HEALTH_CHECK_INTERVAL=5
BLUE_PORT=3000
GREEN_PORT=3001
LOG_FILE="$PROJECT_DIR/logs/deployment.log"

# Detect docker compose command (v1 or v2)
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "Error: Neither 'docker-compose' nor 'docker compose' found!"
    exit 1
fi

# Create log directory
mkdir -p "$PROJECT_DIR/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# =====================================================
# Logging Functions
# =====================================================
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARN:${NC} $1" | tee -a "$LOG_FILE"
}

# =====================================================
# Disk Space Check and Cleanup
# =====================================================
check_disk_space() {
    log "Checking disk space..."

    # Get available space in GB
    AVAILABLE_SPACE=$(df -BG "$PROJECT_DIR" | tail -1 | awk '{print $4}' | sed 's/G//')

    log "Available disk space: ${AVAILABLE_SPACE}GB"

    # If less than 2GB available, run aggressive cleanup
    if [ "$AVAILABLE_SPACE" -lt 2 ]; then
        log_warn "⚠️  Low disk space detected (${AVAILABLE_SPACE}GB)! Running cleanup..."
        cleanup_disk
    elif [ "$AVAILABLE_SPACE" -lt 5 ]; then
        log_warn "⚠️  Disk space is running low (${AVAILABLE_SPACE}GB). Running light cleanup..."
        cleanup_disk
    else
        log "✅ Sufficient disk space available"
    fi
}

cleanup_disk() {
    log "🧹 Starting disk cleanup..."

    # 1. Remove stopped containers
    log "Removing stopped containers..."
    docker ps -aq --filter "status=exited" | xargs -r docker rm -f 2>/dev/null || true

    # 2. Remove dangling images
    log "Removing dangling images..."
    docker images -f "dangling=true" -q | xargs -r docker rmi -f 2>/dev/null || true

    # 3. Clean build cache aggressively
    log "Cleaning build cache..."
    docker builder prune -af 2>/dev/null || true

    # 4. Remove old images (keep only last 2)
    log "Removing old images (keeping last 2)..."
    docker images --format "{{.Repository}}:{{.Tag}} {{.ID}} {{.CreatedAt}}" | \
        grep -E "pacagen|node" | \
        sort -k3 -r | \
        tail -n +3 | \
        awk '{print $2}' | \
        xargs -r docker rmi -f 2>/dev/null || true

    # 5. Clean Docker system (unused data)
    log "Running system prune..."
    docker system prune -af --volumes 2>/dev/null || true

    # 6. Truncate large log files
    log "Cleaning large container logs..."
    sudo find /var/lib/docker/containers/ -name "*-json.log" -size +50M -exec truncate -s 10M {} \; 2>/dev/null || true

    # 7. Clean application logs
    if [ -d "$PROJECT_DIR/logs" ]; then
        log "Cleaning application logs..."
        find "$PROJECT_DIR/logs" -type f -name "*.log" -mtime +7 -delete 2>/dev/null || true
        find "$PROJECT_DIR/logs" -type f -name "*.log" -size +100M -exec truncate -s 10M {} \; 2>/dev/null || true
    fi

    # Show results
    AVAILABLE_SPACE_AFTER=$(df -BG "$PROJECT_DIR" | tail -1 | awk '{print $4}' | sed 's/G//')
    log "✅ Cleanup complete! Available space: ${AVAILABLE_SPACE_AFTER}GB"

    # If still less than 1GB, abort deployment
    if [ "$AVAILABLE_SPACE_AFTER" -lt 1 ]; then
        log_error "❌ Critical: Still less than 1GB free space after cleanup!"
        log_error "Please manually free up disk space before deploying."
        exit 1
    fi
}

# =====================================================
# Health Check Function
# =====================================================
health_check() {
    local port=$1
    local max_attempts=$((HEALTH_CHECK_TIMEOUT / HEALTH_CHECK_INTERVAL))
    local attempt=1

    log "Running health check on port $port (timeout: ${HEALTH_CHECK_TIMEOUT}s)..."

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s http://localhost:$port/api/health > /dev/null 2>&1; then
            log "✅ Health check passed on port $port (attempt $attempt)"
            return 0
        fi

        log_warn "Health check attempt $attempt/$max_attempts failed, retrying in ${HEALTH_CHECK_INTERVAL}s..."
        sleep $HEALTH_CHECK_INTERVAL
        attempt=$((attempt + 1))
    done

    log_error "❌ Health check failed after $max_attempts attempts"
    return 1
}

# =====================================================
# Get Current Active Container
# =====================================================
get_active_container() {
    if docker ps --filter "name=pacagen_app_blue" --filter "status=running" | grep -q "pacagen_app_blue"; then
        echo "blue"
    elif docker ps --filter "name=pacagen_app_green" --filter "status=running" | grep -q "pacagen_app_green"; then
        echo "green"
    else
        echo "none"
    fi
}

# =====================================================
# Update Nginx Configuration
# =====================================================
update_nginx() {
    local target_container=$1
    local target_port=""
    local nginx_config="/etc/nginx/sites-enabled/pacagen-hub"

    # Determine target port
    if [ "$target_container" = "blue" ]; then
        target_port="3000"
    else
        target_port="3001"
    fi

    log "Updating Nginx to route traffic to $target_container (port $target_port)..."

    # Check if Nginx config exists
    if [ ! -f "$nginx_config" ]; then
        log_warn "Nginx config not found at $nginx_config"
        return 1
    fi

    # Backup current config (to /tmp to avoid nginx loading it)
    local backup_file="/tmp/pacagen-hub-nginx.backup.$(date +%Y%m%d_%H%M%S)"
    sudo cp "$nginx_config" "$backup_file"
    log "Config backed up to $backup_file"

    # Update upstream block using markers
    # This replaces the entire server line between BLUE_GREEN_MARKER_START and BLUE_GREEN_MARKER_END
    sudo sed -i "/# BLUE_GREEN_MARKER_START/,/# BLUE_GREEN_MARKER_END/{
        /# BLUE_GREEN_MARKER_START/!{
            /# BLUE_GREEN_MARKER_END/!{
                d
            }
        }
    }" "$nginx_config"

    # Insert new server line
    sudo sed -i "/# BLUE_GREEN_MARKER_START/a\\    server localhost:${target_port} max_fails=3 fail_timeout=30s;" "$nginx_config"

    # Test nginx configuration
    if sudo nginx -t > /dev/null 2>&1; then
        sudo nginx -s reload
        log "✅ Nginx configuration updated and reloaded"
        log "Traffic now pointing to port $target_port ($target_container container)"
        return 0
    else
        log_error "❌ Nginx configuration test failed"
        log_error "Restoring backup..."

        # Restore backup
        sudo cp "$backup_file" "$nginx_config"

        return 1
    fi
}

# =====================================================
# Rollback Function
# =====================================================
rollback() {
    local old_container=$1
    local new_container=$2

    log_error "Deployment failed, initiating rollback..."

    # Stop the new container
    $DOCKER_COMPOSE -p "$PROJECT_NAME" -f "$COMPOSE_FILE" stop "app-$new_container" || true
    $DOCKER_COMPOSE -p "$PROJECT_NAME" -f "$COMPOSE_FILE" rm -f "app-$new_container" || true

    # Ensure old container is still running
    if ! docker ps | grep -q "pacagen_app_$old_container"; then
        log_warn "Old container not running, attempting to start..."
        $DOCKER_COMPOSE -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up -d "app-$old_container"

        if ! health_check $([ "$old_container" = "blue" ] && echo "$BLUE_PORT" || echo "$GREEN_PORT"); then
            log_error "❌ Rollback failed! Manual intervention required!"
            exit 1
        fi
    fi

    log "✅ Rollback completed, $old_container is still active"
}

# =====================================================
# Main Deployment Logic
# =====================================================
main() {
    log "=========================================="
    log "Starting Blue-Green Deployment"
    log "=========================================="

    # Change to project directory
    cd "$PROJECT_DIR" || exit 1

    # Check disk space and cleanup if needed
    check_disk_space

    # Determine current and target containers
    CURRENT=$(get_active_container)

    if [ "$CURRENT" = "blue" ]; then
        TARGET="green"
        TARGET_PORT=$GREEN_PORT
        OLD_PORT=$BLUE_PORT
    elif [ "$CURRENT" = "green" ]; then
        TARGET="blue"
        TARGET_PORT=$BLUE_PORT
        OLD_PORT=$GREEN_PORT
    else
        # First deployment, use blue
        log_warn "No active container found, deploying to blue..."
        TARGET="blue"
        CURRENT="none"
        TARGET_PORT=$BLUE_PORT
        OLD_PORT=""
    fi

    log "Current active container: $CURRENT"
    log "Target deployment container: $TARGET"

    # Ensure postgres is running (only once)
    if ! docker ps | grep -q "pacagen_hub_postgres_prod"; then
        log "Starting shared postgres container..."
        $DOCKER_COMPOSE -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up -d postgres
        log "Waiting for postgres to be ready..."
        sleep 15
    else
        log "✅ Postgres container already running"
    fi

    # Build and start new container
    log "Building and starting app-$TARGET container..."
    $DOCKER_COMPOSE -p "$PROJECT_NAME" -f "$COMPOSE_FILE" build "app-$TARGET"
    $DOCKER_COMPOSE -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up -d --no-deps "app-$TARGET"

    # Wait for container to be ready
    sleep 10

    # Health check
    if ! health_check "$TARGET_PORT"; then
        rollback "$CURRENT" "$TARGET"
        exit 1
    fi

    # Update Nginx (if configured)
    if [ -f "/etc/nginx/sites-enabled/pacagen-hub" ]; then
        log "Attempting to update Nginx configuration..."
        if update_nginx "$TARGET"; then
            log "✅ Nginx updated successfully"
            # Wait for connection draining
            log "Waiting 10s for connection draining..."
            sleep 10
        else
            log_warn "⚠️  Nginx update failed, but deployment will continue"
            log_warn "Please manually update Nginx to point to port $TARGET_PORT"
            log_warn "You can run: sudo sed -i 's/localhost:[0-9]*/localhost:$TARGET_PORT/' /etc/nginx/sites-enabled/pacagen-hub && sudo nginx -s reload"
        fi
    else
        log_warn "Nginx config not found, skipping traffic switch"
        log_warn "Make sure to update your load balancer manually"
    fi

    # Stop old container
    if [ "$CURRENT" != "none" ]; then
        log "Stopping old container: app-$CURRENT..."
        $DOCKER_COMPOSE -p "$PROJECT_NAME" -f "$COMPOSE_FILE" stop "app-$CURRENT"
        log "✅ Old container stopped"

        # Remove old container to save space
        log "Removing old container..."
        $DOCKER_COMPOSE -p "$PROJECT_NAME" -f "$COMPOSE_FILE" rm -f "app-$CURRENT" || true
    fi

    # Post-deployment cleanup
    log "Running post-deployment cleanup..."

    # Remove dangling images
    docker image prune -f 2>/dev/null || true

    # Clean up old images of the stopped container
    docker images | grep "pacagen" | grep "<none>" | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true

    # Show final disk usage
    FINAL_SPACE=$(df -BG "$PROJECT_DIR" | tail -1 | awk '{print $4}' | sed 's/G//')
    log "Final available disk space: ${FINAL_SPACE}GB"

    log "=========================================="
    log "✅ Deployment completed successfully!"
    log "Active container: app-$TARGET on port $TARGET_PORT"
    log "=========================================="

    # Show running containers
    docker ps --filter "name=pacagen_app"
}

# Run main function
main "$@"
