#!/bin/bash
# =====================================================
# Unified Cleanup Script - Clean ALL Pacagen Containers
# =====================================================
# This script removes ALL pacagen-related containers and images
# Use this when you need to start fresh or free up disk space
#
# Usage: ./scripts/cleanup-all.sh
# =====================================================

set -e

echo "🧹 Starting Complete Cleanup"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Show current state
echo ""
echo "📊 Current disk usage:"
df -h | grep -E '^Filesystem|/$'

echo ""
echo "📊 Current Docker disk usage:"
docker system df

echo ""
echo "📦 Current pacagen containers:"
docker ps -a | grep pacagen || echo "No pacagen containers found"

# Confirm action
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will stop and remove ALL pacagen containers and images!${NC}"
echo -e "${YELLOW}   Database data will be preserved in Docker volumes.${NC}"
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "🛑 Step 1: Stopping all pacagen containers..."
docker ps -a | grep pacagen | awk '{print $1}' | xargs -r docker stop 2>/dev/null || echo "No containers to stop"

echo ""
echo "🗑️  Step 2: Removing all pacagen containers..."
docker ps -a | grep pacagen | awk '{print $1}' | xargs -r docker rm -f 2>/dev/null || echo "No containers to remove"

echo ""
echo "🗑️  Step 3: Removing pacagen images..."
docker images | grep pacagen | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || echo "No pacagen images to remove"

echo ""
echo "🗑️  Step 4: Removing dangling images..."
docker images -f "dangling=true" -q | xargs -r docker rmi -f 2>/dev/null || echo "No dangling images"

echo ""
echo "🗑️  Step 5: Removing build cache..."
docker builder prune -af 2>/dev/null || echo "Build cache cleaned"

echo ""
echo "🗑️  Step 6: Cleaning Docker system..."
docker system prune -af 2>/dev/null || echo "System pruned"

echo ""
echo "🗑️  Step 7: Truncating large container logs..."
sudo find /var/lib/docker/containers/ -name "*-json.log" -size +50M -exec truncate -s 10M {} \; 2>/dev/null || echo "Logs truncated"

echo ""
echo "🗑️  Step 8: Cleaning application logs..."
if [ -d "$HOME/pacagen-hub/logs" ]; then
    find "$HOME/pacagen-hub/logs" -type f -name "*.log" -mtime +7 -delete 2>/dev/null || true
    find "$HOME/pacagen-hub/logs" -type f -name "*.log" -size +100M -exec truncate -s 10M {} \; 2>/dev/null || true
    echo "Application logs cleaned"
fi

# Show results
echo ""
echo "=========================================="
echo -e "${GREEN}✅ Cleanup Complete!${NC}"
echo "=========================================="

echo ""
echo "📊 New disk usage:"
df -h | grep -E '^Filesystem|/$'

echo ""
echo "📊 New Docker disk usage:"
docker system df

echo ""
echo "📦 Remaining containers:"
docker ps -a

echo ""
echo "🎯 Next steps:"
echo "  1. Run deployment: cd ~/pacagen-hub && ./scripts/deploy-blue-green.sh"
echo "  2. Or manually start: docker compose -p pacagen -f docker-compose.prod.yml up -d"

# Check final space
AVAILABLE=$(df -BG / | tail -1 | awk '{print $4}' | sed 's/G//')
echo ""
if [ "$AVAILABLE" -gt 5 ]; then
    echo -e "${GREEN}✅ You have ${AVAILABLE}GB free space - ready to deploy!${NC}"
else
    echo -e "${YELLOW}⚠️  Warning: Only ${AVAILABLE}GB free. Consider increasing EBS volume.${NC}"
fi
