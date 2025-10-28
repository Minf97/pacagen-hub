#!/bin/bash
# =====================================================
# Docker Cleanup Script
# =====================================================
# Cleans up unused Docker resources to free disk space
# Run this before each deployment to prevent disk space issues

set -e

echo "🧹 Starting Docker cleanup..."

# =====================================================
# Show current disk usage
# =====================================================
echo ""
echo "📊 Current disk usage:"
df -h | grep -E '^Filesystem|/$'
echo ""

echo "📊 Current Docker disk usage:"
docker system df

# =====================================================
# Stop all containers (except current ones)
# =====================================================
echo ""
echo "🛑 Stopping old containers..."
docker ps -aq --filter "status=exited" | xargs -r docker rm -f 2>/dev/null || true

# =====================================================
# Remove dangling images
# =====================================================
echo ""
echo "🗑️  Removing dangling images..."
docker images -f "dangling=true" -q | xargs -r docker rmi -f 2>/dev/null || true

# =====================================================
# Remove old images (keep last 3 builds)
# =====================================================
echo ""
echo "🗑️  Removing old images (keeping last 3 builds)..."

# Get list of images for this project, sorted by creation date
# Keep only the 3 most recent, delete the rest
docker images --format "{{.Repository}}:{{.Tag}} {{.ID}} {{.CreatedAt}}" | \
  grep "pacagen" | \
  sort -k3 -r | \
  tail -n +4 | \
  awk '{print $2}' | \
  xargs -r docker rmi -f 2>/dev/null || true

# =====================================================
# Clean build cache
# =====================================================
echo ""
echo "🗑️  Cleaning build cache..."
docker builder prune -f --filter "until=24h" 2>/dev/null || true

# =====================================================
# Remove unused volumes (be careful!)
# =====================================================
echo ""
read -p "❓ Remove unused volumes? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🗑️  Removing unused volumes..."
  docker volume prune -f
else
  echo "⏭️  Skipping volume cleanup"
fi

# =====================================================
# Clean container logs (if they're too large)
# =====================================================
echo ""
echo "🗑️  Cleaning large container logs..."
find /var/lib/docker/containers/ -name "*-json.log" -size +100M -exec truncate -s 0 {} \; 2>/dev/null || true

# =====================================================
# Final cleanup
# =====================================================
echo ""
echo "🧹 Running final system cleanup..."
docker system prune -f --filter "until=24h"

# =====================================================
# Show results
# =====================================================
echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📊 New disk usage:"
df -h | grep -E '^Filesystem|/$'
echo ""

echo "📊 New Docker disk usage:"
docker system df

echo ""
echo "🎉 Done! You can now run your deployment."
