# Database Management Guide

## 🗄️ Accessing Production Database

### Method 1: psql CLI (Quick & Secure) ⭐

**Best for**: Quick queries, checking data, running SQL

```bash
# Connect to database
docker exec -it pacagen_hub_postgres_prod psql -U pacagen -d pacagen_hub_prod

# Common commands
\dt                          # List all tables
\d table_name                # Describe table structure
\du                          # List users
\l                           # List databases
\q                           # Quit

# Example queries
SELECT * FROM experiments;
SELECT * FROM variants WHERE experiment_id = 'some-id';
SELECT COUNT(*) FROM events;
```

### Method 2: SSH Port Forward + Drizzle Studio (Secure) 🔒

**Best for**: Visual database browsing, complex queries, schema inspection

**On your local machine:**
```bash
# Create SSH tunnel
ssh -L 4983:localhost:4983 ubuntu@18.191.75.25

# Keep this terminal open
```

**On AWS server (in another terminal):**
```bash
cd ~/pacagen-hub
docker exec pacagen_hub_app_prod npm run db:studio
```

**On your local browser:**
Visit `http://localhost:4983`

## 🔄 Database Migrations

### Check Migration Status

```bash
# View migration logs from container startup
docker logs pacagen_hub_app_prod | grep -A 10 "database migrations"

# Manually run migrations
docker exec pacagen_hub_app_prod npm run db:migrate

# Check current tables
docker exec -it pacagen_hub_postgres_prod psql -U pacagen -d pacagen_hub_prod -c "\dt"
```

### Generate New Migration

**On local machine:**
```bash
# 1. Modify schema
vim lib/db/schema.ts

# 2. Generate migration
npm run db:generate

# 3. Test locally
npm run db:migrate

# 4. Commit and push
git add drizzle/migrations lib/db/schema.ts
git commit -m "feat: add new table"
git push
```

**On server:**
```bash
cd ~/pacagen-hub
git pull

# Restart app (migrations run automatically on startup)
docker compose -f docker-compose.prod.yml restart app

# Or run manually
docker exec pacagen_hub_app_prod npm run db:migrate
```

## 💾 Database Backup & Restore

### Create Backup

```bash
# Create backup directory
mkdir -p ~/backups

# Backup database
docker exec pacagen_hub_postgres_prod pg_dump -U pacagen pacagen_hub_prod > ~/backups/backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh ~/backups/

# Compress backup (optional)
gzip ~/backups/backup_*.sql
```

### Restore Backup

```bash
# Stop application
docker compose -f docker-compose.prod.yml stop app

# Restore database
docker exec -i pacagen_hub_postgres_prod psql -U pacagen -d pacagen_hub_prod < ~/backups/backup_20250124_120000.sql

# Or if compressed
gunzip -c ~/backups/backup_20250124_120000.sql.gz | docker exec -i pacagen_hub_postgres_prod psql -U pacagen -d pacagen_hub_prod

# Restart application
docker compose -f docker-compose.prod.yml start app
```

### Automated Backups (Cron)

```bash
# Create backup script
cat > ~/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/pacagen_backup_${TIMESTAMP}.sql.gz"

# Create backup
docker exec pacagen_hub_postgres_prod pg_dump -U pacagen pacagen_hub_prod | gzip > "$BACKUP_FILE"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "pacagen_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
EOF

chmod +x ~/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /home/ubuntu/backup-db.sh >> /var/log/backup.log 2>&1
```

## 🔍 Troubleshooting

### Database Connection Issues

```bash
# Check database is running
docker ps | grep postgres

# Check database logs
docker logs pacagen_hub_postgres_prod

# Test connection from app container
docker exec pacagen_hub_app_prod pg_isready -h postgres -p 5432 -U pacagen

# Test connection with psql
docker exec pacagen_hub_app_prod psql -h postgres -U pacagen -d pacagen_hub_prod -c "SELECT 1"
```

### Migration Failures

```bash
# Check migration logs
docker logs pacagen_hub_app_prod | grep -i migration

# Check which migrations are applied
docker exec -it pacagen_hub_postgres_prod psql -U pacagen -d pacagen_hub_prod -c "SELECT * FROM drizzle.__drizzle_migrations"

# Manually apply specific migration
docker exec -i pacagen_hub_postgres_prod psql -U pacagen -d pacagen_hub_prod < drizzle/migrations/0001_migration.sql
```

### Performance Issues

```bash
# Check active connections
docker exec -it pacagen_hub_postgres_prod psql -U pacagen -d pacagen_hub_prod -c "SELECT count(*) FROM pg_stat_activity"

# Check slow queries
docker exec -it pacagen_hub_postgres_prod psql -U pacagen -d pacagen_hub_prod -c "SELECT query, calls, total_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10"

# Check database size
docker exec -it pacagen_hub_postgres_prod psql -U pacagen -d pacagen_hub_prod -c "SELECT pg_size_pretty(pg_database_size('pacagen_hub_prod'))"

# Check table sizes
docker exec -it pacagen_hub_postgres_prod psql -U pacagen -d pacagen_hub_prod -c "SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC"
```

## 📊 Quick Reference

| Task | Command |
|------|---------|
| Connect to DB | `docker exec -it pacagen_hub_postgres_prod psql -U pacagen -d pacagen_hub_prod` |
| Run migrations | `docker exec pacagen_hub_app_prod npm run db:migrate` |
| Create backup | `docker exec pacagen_hub_postgres_prod pg_dump -U pacagen pacagen_hub_prod > backup.sql` |
| View logs | `docker logs pacagen_hub_postgres_prod` |
| Start Studio (local) | `npm run db:studio` (via SSH tunnel recommended) |
| Check tables | `docker exec -it pacagen_hub_postgres_prod psql -U pacagen -d pacagen_hub_prod -c "\dt"` |

---

**Last Updated**: 2025-10-24
