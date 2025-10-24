#!/bin/bash
# =====================================================
# Memory Monitoring Script
# =====================================================
# Monitors Docker container memory usage and alerts when high
# Usage: ./monitor-memory.sh
# Or add to cron: */5 * * * * /path/to/monitor-memory.sh

set -e

# Configuration
THRESHOLD=80  # Alert when memory usage exceeds 80%
LOG_FILE="/var/log/pacagen-memory.log"

echo "=== Memory Check $(date) ===" | tee -a "$LOG_FILE"

# Check system memory
echo "📊 System Memory:" | tee -a "$LOG_FILE"
free -h | tee -a "$LOG_FILE"

# Check Docker container memory
echo -e "\n🐳 Docker Container Memory:" | tee -a "$LOG_FILE"
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.CPUPerc}}" | tee -a "$LOG_FILE"

# Get container memory percentage
APP_MEM=$(docker stats --no-stream --format "{{.MemPerc}}" pacagen_hub_app_prod | sed 's/%//')
DB_MEM=$(docker stats --no-stream --format "{{.MemPerc}}" pacagen_hub_postgres_prod | sed 's/%//')

# Alert if memory usage is high
if (( $(echo "$APP_MEM > $THRESHOLD" | bc -l) )); then
  echo "⚠️  WARNING: App container memory usage is HIGH: ${APP_MEM}%" | tee -a "$LOG_FILE"

  # Optional: Restart container if memory is critically high
  if (( $(echo "$APP_MEM > 95" | bc -l) )); then
    echo "🔄 CRITICAL: Restarting app container..." | tee -a "$LOG_FILE"
    docker restart pacagen_hub_app_prod
  fi
fi

if (( $(echo "$DB_MEM > $THRESHOLD" | bc -l) )); then
  echo "⚠️  WARNING: Database memory usage is HIGH: ${DB_MEM}%" | tee -a "$LOG_FILE"
fi

echo "✅ Memory check completed" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
