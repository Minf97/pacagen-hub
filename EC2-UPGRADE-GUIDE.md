# EC2 Instance Upgrade Guide

## 🚀 Upgrading from t3.small (2GB) to t3.medium (4GB)

### Pre-Upgrade Checklist

- [ ] Create database backup
- [ ] Create application backup
- [ ] Note down current Elastic IP (if any)
- [ ] Document current Docker container status
- [ ] Estimate downtime window (typically 5-10 minutes)

### Step-by-Step Upgrade Process

#### 1. Backup Everything

```bash
# SSH to server
ssh ubuntu@18.191.75.25

# Backup database
cd ~/pacagen-hub
docker exec pacagen_hub_postgres_prod pg_dump -U pacagen pacagen_hub_prod > ~/backup_$(date +%Y%m%d_%H%M%S).sql

# Backup application
tar -czf ~/app_backup_$(date +%Y%m%d_%H%M%S).tar.gz ~/pacagen-hub

# Verify backups
ls -lh ~/*.sql
ls -lh ~/*.tar.gz
```

#### 2. Gracefully Stop Application

```bash
# Stop Docker containers
cd ~/pacagen-hub
docker compose -f docker-compose.prod.yml down

# Verify all stopped
docker ps -a

# Exit SSH
exit
```

#### 3. Upgrade Instance in AWS Console

1. Go to EC2 Dashboard: https://console.aws.amazon.com/ec2/
2. Select your instance
3. Click `Instance state` → `Stop instance` (wait ~30s)
4. Click `Actions` → `Instance settings` → `Change instance type`
5. Select `t3.medium`
6. Click `Apply`
7. Click `Instance state` → `Start instance`
8. Wait for status to become `Running`

#### 4. Apply Optimized Configuration

```bash
# SSH back to server (check new IP if it changed)
ssh ubuntu@18.191.75.25

# Verify new memory
free -h
# Should show ~4GB total memory

# Pull optimized configuration
cd ~/pacagen-hub
git pull

# Restart with new resource limits
docker compose -f docker-compose.prod.yml up -d

# Monitor startup
docker compose -f docker-compose.prod.yml logs -f
```

#### 5. Verify Upgrade

```bash
# Check system resources
free -h
htop  # (press q to quit)

# Check Docker resource usage
docker stats

# Test application
curl http://localhost:3000/api/health

# Test in browser
# Visit: http://YOUR_IP:3000
```

### Optimized Resource Allocation (t3.medium - 4GB)

**Previous (t3.small - 2GB):**
- App: 1GB limit, 768MB heap
- PostgreSQL: 512MB limit, 128MB shared buffers
- System: ~512MB
- Swap: 2GB

**New (t3.medium - 4GB):**
- App: 2GB limit, 1.5GB heap
- PostgreSQL: 1GB limit, 256MB shared buffers
- Drizzle Studio: 256MB limit
- System: ~768MB
- Swap: 2GB (keep as safety net)

### Expected Performance Improvements

- ✅ **2x faster** database queries (more cache)
- ✅ **~50% more** concurrent users
- ✅ **Reduced** OOM risk significantly
- ✅ **Smoother** operations during traffic spikes
- ✅ **Better** for future growth

### Cost Impact

| Instance | vCPU | RAM | Price/Month |
|----------|------|-----|-------------|
| t3.small | 2 | 2GB | ~$15 |
| t3.medium | 2 | 4GB | ~$30 |

**Cost increase:** ~$15/month (+100%)
**Performance increase:** ~50-100% depending on workload

### Rollback Plan (If Needed)

If you need to downgrade:

```bash
# 1. Stop application
cd ~/pacagen-hub
docker compose -f docker-compose.prod.yml down

# 2. Exit SSH and stop instance in AWS Console
exit

# 3. Change instance type back to t3.small

# 4. Revert configuration
cd ~/pacagen-hub
git checkout HEAD~1 docker-compose.prod.yml

# 5. Restart
docker compose -f docker-compose.prod.yml up -d
```

### Troubleshooting

**Issue: Public IP changed after restart**
- Check new IP in AWS Console
- Update DNS records if using custom domain
- Update SSH config

**Issue: Containers won't start**
```bash
# Check logs
docker compose -f docker-compose.prod.yml logs

# Reset and restart
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d
```

**Issue: Database data missing**
```bash
# Restore from backup
docker exec -i pacagen_hub_postgres_prod psql -U pacagen -d pacagen_hub_prod < ~/backup_YYYYMMDD_HHMMSS.sql
```

### Alternative: Using AWS CLI

If you have AWS CLI configured:

```bash
# Get instance ID
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=ip-address,Values=18.191.75.25" \
  --query "Reservations[0].Instances[0].InstanceId" \
  --output text)

# Stop instance
aws ec2 stop-instances --instance-ids $INSTANCE_ID
aws ec2 wait instance-stopped --instance-ids $INSTANCE_ID

# Change type
aws ec2 modify-instance-attribute \
  --instance-id $INSTANCE_ID \
  --instance-type t3.medium

# Start instance
aws ec2 start-instances --instance-ids $INSTANCE_ID
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

echo "✅ Upgrade complete!"
```

### Post-Upgrade Monitoring

Monitor for 24-48 hours after upgrade:

```bash
# Memory usage
free -h

# Docker stats (real-time)
docker stats

# Application logs
docker compose -f docker-compose.prod.yml logs -f app

# Database logs
docker compose -f docker-compose.prod.yml logs -f postgres

# Memory monitoring script (if configured)
tail -f /var/log/pacagen-memory.log
```

---

**Last Updated:** 2025-10-24
**Recommended Instance:** t3.medium for production workloads
