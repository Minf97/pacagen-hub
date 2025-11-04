#!/bin/bash
# =====================================================
# Emergency Disk Cleanup Script
# =====================================================
# Use this when disk is full and deployment fails
# This is more aggressive than the regular cleanup
#
# Usage: sudo ./scripts/emergency-cleanup.sh
# =====================================================

set -e

echo "🚨 Emergency Disk Cleanup"
echo "=========================================="

# Show current disk usage
echo ""
echo "📊 Current disk usage:"
df -h | grep -E '^Filesystem|/$'
echo ""

# 1. Stop all non-essential containers
echo "🛑 Stopping all non-postgres containers..."
docker ps --format "{{.Names}}" | grep -v postgres | xargs -r docker stop 2>/dev/null || true

# 2. Remove all stopped containers
echo "🗑️  Removing all stopped containers..."
docker ps -aq --filter "status=exited" | xargs -r docker rm -f 2>/dev/null || true
docker ps -aq --filter "status=created" | xargs -r docker rm -f 2>/dev/null || true

# 3. Remove ALL dangling images
echo "🗑️  Removing ALL dangling images..."
docker images -f "dangling=true" -q | xargs -r docker rmi -f 2>/dev/null || true

# 4. Clean ALL build cache
echo "🗑️  Cleaning ALL build cache..."
docker builder prune -af --force 2>/dev/null || true

# 5. Remove old images (keep only 1 most recent)
echo "🗑️  Removing old images (keeping only latest)..."
docker images --format "{{.Repository}}:{{.Tag}} {{.ID}} {{.CreatedAt}}" | \
    grep "pacagen" | \
    sort -k3 -r | \
    tail -n +2 | \
    awk '{print $2}' | \
    xargs -r docker rmi -f 2>/dev/null || true

# 6. Aggressive system prune
echo "🗑️  Running aggressive system prune..."
docker system prune -af --volumes --force 2>/dev/null || true

# 7. Clean Docker logs aggressively
echo "🗑️  Truncating Docker container logs..."
sudo find /var/lib/docker/containers/ -name "*-json.log" -exec truncate -s 0 {} \; 2>/dev/null || true

# 8. Clean system logs
echo "🗑️  Cleaning system logs..."
sudo journalctl --vacuum-time=1d 2>/dev/null || true
sudo truncate -s 0 /var/log/syslog 2>/dev/null || true
sudo truncate -s 0 /var/log/kern.log 2>/dev/null || true

# 9. Clean APT cache
echo "🗑️  Cleaning APT cache..."
sudo apt-get clean 2>/dev/null || true
sudo apt-get autoremove -y 2>/dev/null || true

# 10. Clean application logs
echo "🗑️  Cleaning application logs..."
if [ -d "$HOME/pacagen-hub/logs" ]; then
    find "$HOME/pacagen-hub/logs" -type f -name "*.log" -delete 2>/dev/null || true
fi

# 11. Clean tmp files
echo "🗑️  Cleaning temp files..."
sudo rm -rf /tmp/* 2>/dev/null || true
sudo rm -rf /var/tmp/* 2>/dev/null || true

# Show results
echo ""
echo "✅ Emergency cleanup complete!"
echo ""
echo "📊 New disk usage:"
df -h | grep -E '^Filesystem|/$'
echo ""

echo "📊 Docker disk usage:"
docker system df
echo ""

# Check if we have enough space now
AVAILABLE=$(df -BG / | tail -1 | awk '{print $4}' | sed 's/G//')
echo "Available space: ${AVAILABLE}GB"

if [ "$AVAILABLE" -lt 2 ]; then
    echo ""
    echo "⚠️  WARNING: Still less than 2GB free!"
    echo "Consider:"
    echo "  1. Increasing EBS volume size"
    echo "  2. Deleting unused files manually"
    echo "  3. Moving logs to S3"
else
    echo ""
    echo "✅ You can now run deployment again!"
fi
