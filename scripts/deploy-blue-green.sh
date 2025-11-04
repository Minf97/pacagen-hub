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
HEALTH_CHECK_TIMEOUT=60
HEALTH_CHECK_INTERVAL=5
BLUE_PORT=3000
GREEN_PORT=3001
LOG_FILE="$PROJECT_DIR/logs/deployment.log"

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
    local nginx_config="/etc/nginx/sites-enabled/pacagen-hub"

    log "Updating Nginx to route traffic to $target_container..."

    # Update upstream in nginx config
    if [ "$target_container" = "blue" ]; then
        sudo sed -i 's/server localhost:3001/server localhost:3000/g' "$nginx_config"
    else
        sudo sed -i 's/server localhost:3000/server localhost:3001/g' "$nginx_config"
    fi

    # Test nginx configuration
    if sudo nginx -t > /dev/null 2>&1; then
        sudo nginx -s reload
        log "✅ Nginx configuration updated and reloaded"
        return 0
    else
        log_error "❌ Nginx configuration test failed"
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
    docker-compose -f "$COMPOSE_FILE" stop "app-$new_container" || true
    docker-compose -f "$COMPOSE_FILE" rm -f "app-$new_container" || true

    # Ensure old container is still running
    if ! docker ps | grep -q "pacagen_app_$old_container"; then
        log_warn "Old container not running, attempting to start..."
        docker-compose -f "$COMPOSE_FILE" up -d "app-$old_container"

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

    # Create log directory
    mkdir -p "$PROJECT_DIR/logs"

    # Change to project directory
    cd "$PROJECT_DIR" || exit 1

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

    # Build and start new container
    log "Building and starting app-$TARGET container..."
    docker-compose -f "$COMPOSE_FILE" build "app-$TARGET"
    docker-compose -f "$COMPOSE_FILE" up -d "app-$TARGET"

    # Wait for container to be ready
    sleep 10

    # Health check
    if ! health_check "$TARGET_PORT"; then
        rollback "$CURRENT" "$TARGET"
        exit 1
    fi

    # Update Nginx (if configured)
    if [ -f "/etc/nginx/sites-enabled/pacagen-hub" ]; then
        if ! update_nginx "$TARGET"; then
            rollback "$CURRENT" "$TARGET"
            exit 1
        fi

        # Wait for connection draining
        log "Waiting 10s for connection draining..."
        sleep 10
    else
        log_warn "Nginx config not found, skipping traffic switch"
        log_warn "Make sure to update your load balancer manually"
    fi

    # Stop old container
    if [ "$CURRENT" != "none" ]; then
        log "Stopping old container: app-$CURRENT..."
        docker-compose -f "$COMPOSE_FILE" stop "app-$CURRENT"
        log "✅ Old container stopped"
    fi

    # Cleanup old images (keep last 3)
    log "Cleaning up old Docker images..."
    docker image prune -f

    log "=========================================="
    log "✅ Deployment completed successfully!"
    log "Active container: app-$TARGET on port $TARGET_PORT"
    log "=========================================="

    # Show running containers
    docker ps --filter "name=pacagen_app"
}

# Run main function
main "$@"
