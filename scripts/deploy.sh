#!/bin/bash
# =====================================================
# Production Deployment Script
# =====================================================
# Automated deployment with built-in cleanup
# Usage: ./scripts/deploy.sh

set -e

echo "🚀 Starting PacagenHub Production Deployment"
echo "=============================================="

# =====================================================
# Configuration
# =====================================================
COMPOSE_FILE="docker-compose.prod.yml"
CLEANUP_ENABLED=${AUTO_CLEANUP:-true}

# =====================================================
# Pre-deployment checks
# =====================================================
echo ""
echo "✅ Running pre-deployment checks..."

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker first."
  exit 1
fi

# Check if compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
  echo "❌ $COMPOSE_FILE not found!"
  exit 1
fi

# Check disk space (warn if less than 5GB free)
FREE_SPACE=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
if [ "$FREE_SPACE" -lt 5 ]; then
  echo "⚠️  Warning: Less than 5GB free space available!"
  echo "   Current free space: ${FREE_SPACE}GB"
  echo "   Consider running cleanup first."
fi

# =====================================================
# Git updates (optional)
# =====================================================
echo ""
read -p "📥 Pull latest code from git? (Y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
  echo "📥 Pulling latest code..."
  git pull
else
  echo "⏭️  Skipping git pull"
fi

# =====================================================
# Docker cleanup
# =====================================================
if [ "$CLEANUP_ENABLED" = true ]; then
  echo ""
  echo "🧹 Running Docker cleanup..."

  # Run cleanup script if it exists
  if [ -f "scripts/docker-cleanup.sh" ]; then
    bash scripts/docker-cleanup.sh
  else
    # Fallback: basic cleanup
    echo "Running basic cleanup..."
    docker system prune -f --filter "until=24h"
    docker builder prune -f --filter "until=24h"
  fi
else
  echo "⏭️  Skipping cleanup (AUTO_CLEANUP=false)"
fi

# =====================================================
# Stop current containers
# =====================================================
echo ""
echo "🛑 Stopping current containers..."
docker compose -f $COMPOSE_FILE down

# =====================================================
# Build and start
# =====================================================
echo ""
echo "🏗️  Building new images..."
docker compose -f $COMPOSE_FILE build --no-cache

echo ""
echo "🚀 Starting containers..."
docker compose -f $COMPOSE_FILE up -d

# =====================================================
# Wait for health checks
# =====================================================
echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check if app is healthy
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  if docker compose -f $COMPOSE_FILE ps | grep -q "healthy"; then
    echo "✅ Services are healthy!"
    break
  fi

  ATTEMPT=$((ATTEMPT + 1))
  echo "⏳ Waiting... ($ATTEMPT/$MAX_ATTEMPTS)"
  sleep 2

  if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "⚠️  Warning: Services did not report healthy status"
    echo "   Check logs with: docker compose -f $COMPOSE_FILE logs"
  fi
done

# =====================================================
# Post-deployment status
# =====================================================
echo ""
echo "=============================================="
echo "✅ Deployment Complete!"
echo "=============================================="
echo ""

echo "📊 Container Status:"
docker compose -f $COMPOSE_FILE ps

echo ""
echo "📊 Disk Usage:"
df -h | grep -E '^Filesystem|/$'

echo ""
echo "📊 Docker Disk Usage:"
docker system df

echo ""
echo "=============================================="
echo "🎉 PacagenHub is now running!"
echo "=============================================="
echo ""
echo "📝 Useful commands:"
echo "  View logs:    docker compose -f $COMPOSE_FILE logs -f"
echo "  View app logs: docker logs -f pacagen_hub_app_prod"
echo "  Stop:         docker compose -f $COMPOSE_FILE down"
echo "  Restart:      docker compose -f $COMPOSE_FILE restart"
echo ""
