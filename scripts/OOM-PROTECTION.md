# OOM Protection Guide

Complete guide to prevent Out-Of-Memory (OOM) issues in production.

## 🎯 Overview

**Memory Allocation (for t2.micro/t3.small - 1GB RAM):**
- App Container: 1GB limit
- PostgreSQL: 512MB limit
- System + Other: 512MB
- Swap Space: 2GB (emergency buffer)

## 🚀 Quick Setup

### On AWS Server

```bash
# 1. Clone/update repository
cd ~/pacagen-hub
git pull

# 2. Run OOM protection setup (ONE TIME)
sudo bash scripts/setup-oom-protection.sh

# 3. Deploy with new configuration
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build

# 4. Verify memory limits
docker stats

# 5. Setup monitoring (optional but recommended)
chmod +x scripts/monitor-memory.sh
sudo crontab -e
# Add: */5 * * * * /home/ubuntu/pacagen-hub/scripts/monitor-memory.sh
```

## 📊 Resource Limits Configured

### Application Container
- **CPU Limit**: 1.0 cores
- **Memory Limit**: 1GB
- **Memory Reservation**: 512MB
- **Node.js Heap**: 768MB (`--max-old-space-size=768`)
- **OOM Score**: -500 (less likely to be killed)

### PostgreSQL Container
- **CPU Limit**: 0.5 cores
- **Memory Limit**: 512MB
- **Memory Reservation**: 256MB
- **Shared Buffers**: 128MB
- **Max Connections**: 50
- **OOM Score**: Protected

## 🛡️ Protection Mechanisms

### 1. Docker Resource Limits
- Hard memory limits prevent runaway containers
- Containers restart automatically if killed
- Memory reservations ensure minimum resources

### 2. Node.js Memory Management
```javascript
NODE_OPTIONS='--max-old-space-size=768'  // 768MB heap limit
```
- Prevents Node.js from exceeding container limits
- Triggers garbage collection earlier
- Protects against memory leaks

### 3. System-Level Swap
- 2GB swap space provides emergency buffer
- `swappiness=10`: Minimal swapping (only under pressure)
- `vfs_cache_pressure=50`: Balanced cache management

### 4. OOM Killer Configuration
- Protected containers scored lower (killed last)
- SSH and system services protected
- Application containers restart automatically

### 5. Automated Monitoring
- Memory check every 5 minutes
- Alerts when usage exceeds 80%
- Auto-restart if usage exceeds 95%

## 📈 Monitoring Commands

```bash
# Real-time memory usage
docker stats

# Container memory details
docker inspect pacagen_hub_app_prod | grep -A 10 Memory

# System memory
free -h

# Swap usage
swapon --show

# View monitoring logs
tail -f /var/log/pacagen-memory.log

# Check OOM killer history
dmesg | grep -i "out of memory"

# Manual memory check
bash scripts/monitor-memory.sh
```

## 🔧 Troubleshooting

### If OOM Still Occurs

**1. Check which process caused OOM:**
```bash
dmesg | grep -i "killed process"
```

**2. Increase swap space:**
```bash
sudo swapoff /swapfile
sudo dd if=/dev/zero of=/swapfile bs=1M count=4096  # 4GB
sudo mkswap /swapfile
sudo swapon /swapfile
```

**3. Reduce container limits temporarily:**
```yaml
# docker-compose.prod.yml
app:
  deploy:
    resources:
      limits:
        memory: 768M  # Reduced from 1GB
```

**4. Optimize application code:**
- Review database query sizes
- Add pagination to large data fetches
- Implement caching for repeated queries
- Check for memory leaks with `node --inspect`

**5. Upgrade server instance:**
- t2.micro (1GB) → t2.small (2GB)
- t3.small (2GB) → t3.medium (4GB)

## ⚙️ Configuration Files

### docker-compose.prod.yml
```yaml
services:
  app:
    environment:
      NODE_OPTIONS: '--max-old-space-size=768'
    deploy:
      resources:
        limits:
          memory: 1G
    oom_score_adj: -500
```

### /etc/sysctl.conf
```
vm.swappiness=10
vm.vfs_cache_pressure=50
```

### /etc/fstab
```
/swapfile none swap sw 0 0
```

## 📝 Best Practices

1. ✅ **Always monitor** memory usage after deployment
2. ✅ **Test under load** before going live
3. ✅ **Set up alerts** via monitoring script
4. ✅ **Keep swap enabled** as safety net
5. ✅ **Review logs regularly** for OOM warnings
6. ✅ **Optimize queries** to reduce memory usage
7. ✅ **Use pagination** for large datasets
8. ✅ **Implement caching** where appropriate

## 🚨 Alert Thresholds

| Memory Usage | Action |
|--------------|--------|
| < 70% | ✅ Normal operation |
| 70-80% | ⚠️  Monitor closely |
| 80-90% | ⚠️  Alert logged, investigate |
| 90-95% | 🔴 Critical, optimize immediately |
| > 95% | 🔄 Auto-restart container |

## 📚 Additional Resources

- [Docker Memory Management](https://docs.docker.com/config/containers/resource_constraints/)
- [Node.js Memory Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- [PostgreSQL Memory Tuning](https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server)
- [Linux OOM Killer](https://www.kernel.org/doc/gorman/html/understand/understand016.html)

---

**Last Updated**: 2025-10-24
**Maintained By**: DevOps Team
