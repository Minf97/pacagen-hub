# 🚀 Deployment Guide

Complete deployment guide for PacagenHub with development and production environment separation.

---

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Environment Overview](#-environment-overview)
- [Local Development](#-local-development)
- [AWS Development Environment](#-aws-development-environment)
- [AWS Production Environment](#-aws-production-environment)
- [Database Migration Workflow](#-database-migration-workflow)
- [Troubleshooting](#-troubleshooting)

---

## 🎯 Quick Start

### New Team Member Setup

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd pacagen-hub

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.development .env.local

# 4. Start everything (Database + App)
npm run dev:full
```

Done! 🎉 Visit http://localhost:3009

---

## 🌍 Environment Overview

| Environment | Location | Database | Purpose |
|-------------|----------|----------|---------|
| **Local** | Your machine | Docker PostgreSQL | Development & Testing |
| **AWS Dev** | EC2 instance | Docker PostgreSQL | Team testing & staging |
| **AWS Prod** | EC2 instance | Docker PostgreSQL or RDS | Production users |

### Environment Configuration Files

```
.env.development          # Local development (committed to git)
.env.local                # Your personal overrides (NOT committed)
.env.production.example   # Production template (committed to git)
.env.production           # Actual production secrets (NOT committed)
```

---

## 💻 Local Development

### First Time Setup

```bash
# 1. Install Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop

# 2. Clone and install
git clone <your-repo>
cd pacagen-hub
npm install

# 3. Copy development environment
cp .env.development .env.local

# 4. Start everything
npm run dev:full
```

### Available Commands

```bash
# Development
npm run dev              # Start Next.js only (port 3009)
npm run dev:full         # Start DB + Migrate + Next.js

# Docker Management
npm run docker:dev       # Start development database
npm run docker:dev:stop  # Stop development database
npm run docker:dev:logs  # View database logs

# Database Operations
npm run db:generate      # Generate migration from schema changes
npm run db:migrate       # Apply pending migrations
npm run db:studio        # Open Drizzle Studio (DB GUI)
npm run db:reset         # Reset database (⚠️ destroys data)

# Sync with team
npm run sync             # Git pull + install deps + migrate DB
```

### Daily Workflow

```bash
# Morning routine
npm run sync             # Sync with latest changes

# After pulling code with DB changes
npm run db:migrate       # Apply new migrations

# When you modify database schema
npm run db:generate      # Generate migration
npm run db:migrate       # Test the migration
git add drizzle/migrations/* lib/db/schema.ts
git commit -m "feat: add new table"
git push
```

---

## 🔧 AWS Development Environment

### Initial Setup

```bash
# 1. SSH into AWS dev instance
ssh -i your-key.pem ubuntu@your-dev-ip

# 2. Install Docker
sudo apt update
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker $USER
# Log out and back in for group changes

# 3. Clone repository
git clone <your-repo>
cd pacagen-hub

# 4. Setup environment
cp .env.production.example .env.production
nano .env.production  # Edit with dev values

# Example dev values:
# DATABASE_URL=postgresql://pacagen:dev_password@postgres:5432/pacagen_hub_dev
# NEXT_PUBLIC_APP_URL=http://your-dev-ip:3000

# 5. Start services
docker-compose up -d

# 6. Apply migrations
docker exec pacagen_hub_app_prod npm run db:migrate

# 7. Check status
docker ps
docker logs pacagen_hub_app_prod
```

### Deployment Workflow

```bash
# Deploy updates
cd pacagen-hub
git pull
docker-compose down
docker-compose up -d --build

# Apply new migrations
docker exec pacagen_hub_app_prod npm run db:migrate

# Check logs
docker-compose logs -f
```

---

## 🌐 AWS Production Environment

### Prerequisites

- [ ] AWS EC2 instance (t3.small or larger recommended)
- [ ] Docker and Docker Compose installed
- [ ] Domain name configured (optional)
- [ ] SSL certificate (optional, recommended)

### Initial Production Setup

```bash
# 1. SSH into production server
ssh -i your-key.pem ubuntu@your-prod-ip

# 2. Install Docker (if not already)
sudo apt update
sudo apt install -y docker.io docker-compose git
sudo usermod -aG docker $USER

# 3. Clone repository
git clone <your-repo>
cd pacagen-hub

# 4. Setup production environment
cp .env.production.example .env.production
nano .env.production

# IMPORTANT: Set strong passwords and real values!
# DATABASE_URL=postgresql://pacagen:STRONG_PASSWORD@postgres:5432/pacagen_hub_prod
# NEXT_PUBLIC_APP_URL=https://yourdomain.com
# SESSION_SECRET=$(openssl rand -base64 32)

# 5. Build and start production
docker-compose -f docker-compose.prod.yml up -d --build

# 6. Apply migrations
docker exec pacagen_hub_app_prod npm run db:migrate

# 7. Verify deployment
docker ps
curl http://localhost:3000/api/health

# Expected output:
# {"status":"healthy","timestamp":"...","uptime":123}
```

### Production Deployment Workflow

```bash
# 1. SSH to production
ssh ubuntu@your-prod-ip

# 2. Navigate to project
cd pacagen-hub

# 3. Backup database (IMPORTANT!)
docker exec pacagen_hub_postgres_prod pg_dump -U pacagen pacagen_hub_prod > backup_$(date +%Y%m%d_%H%M%S).sql

# 4. Pull latest code
git pull origin main  # or your production branch

# 5. Rebuild and restart
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build

# 6. Apply migrations (if any)
docker exec pacagen_hub_app_prod npm run db:migrate

# 7. Check health
docker ps
docker-compose -f docker-compose.prod.yml logs -f app

# 8. Test application
curl http://localhost:3000/api/health
```

### Production Checklist

- [ ] Strong database passwords set
- [ ] `.env.production` has real values (not example values)
- [ ] Database backups scheduled (cron job)
- [ ] Application accessible at domain/IP
- [ ] Health check endpoint responding
- [ ] Logs are being captured
- [ ] Resource limits appropriate for traffic
- [ ] SSL certificate installed (if using HTTPS)

---

## 🗄️ Database Migration Workflow

### How Team Synchronization Works

```
Developer A (makes changes)          Developer B (gets changes)
├─ Modify lib/db/schema.ts           ├─ git pull
├─ npm run db:generate               ├─ npm run db:migrate
├─ npm run db:migrate (test)         └─ ✅ Database synced!
├─ git add drizzle/migrations/*
└─ git push
```

### Creating a Migration

```bash
# 1. Modify database schema
vim lib/db/schema.ts

# Example: Add a new table
export const newFeature = pgTable('new_feature', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

# 2. Generate migration
npm run db:generate
# Output: Created drizzle/migrations/0005_new_feature.sql

# 3. Review the generated SQL
cat drizzle/migrations/0005_*.sql

# 4. Test migration locally
npm run db:migrate

# 5. Commit to git
git add lib/db/schema.ts drizzle/migrations/
git commit -m "feat: add new_feature table"
git push
```

### Applying Migrations

```bash
# Local development
npm run db:migrate

# Production (Docker)
docker exec pacagen_hub_app_prod npm run db:migrate

# Check migration status
docker exec pacagen_hub_app_prod npm run db:studio
```

### Migration Best Practices

✅ **DO:**
- Always test migrations locally first
- Backup production database before migrating
- Commit migration files to git
- Use descriptive migration names
- Review generated SQL before applying

❌ **DON'T:**
- Modify old migration files (create new ones)
- Delete migration files
- Apply untested migrations to production
- Skip database backups

---

## 🔍 Troubleshooting

### Common Issues

#### 1. Port Already in Use

```bash
# Find process using port 3009
lsof -ti:3009 | xargs kill

# Or change port
npm run dev -- -p 3010
```

#### 2. Database Connection Error

```bash
# Check if database is running
docker ps

# If not running, start it
npm run docker:dev

# Check logs
docker logs pacagen_hub_postgres_dev

# Test connection
docker exec -it pacagen_hub_postgres_dev psql -U pacagen -d pacagen_hub_dev
```

#### 3. Migration Conflicts

```bash
# Reset local database (⚠️ destroys data)
npm run db:reset

# Or manually
docker-compose down -v
docker-compose up -d
npm run db:migrate
```

#### 4. Docker Build Fails

```bash
# Clear Docker cache
docker system prune -a

# Rebuild without cache
docker-compose -f docker-compose.prod.yml build --no-cache
```

#### 5. Production Health Check Fails

```bash
# Check application logs
docker logs pacagen_hub_app_prod

# Check if app is listening
docker exec pacagen_hub_app_prod curl http://localhost:3000/api/health

# Check database connectivity
docker exec pacagen_hub_app_prod pg_isready -h postgres -U pacagen
```

### Useful Commands

```bash
# View all containers
docker ps -a

# View logs
docker-compose logs -f [service_name]

# Execute command in container
docker exec -it [container_name] bash

# Database backup
docker exec pacagen_hub_postgres_prod pg_dump -U pacagen pacagen_hub_prod > backup.sql

# Database restore
docker exec -i pacagen_hub_postgres_prod psql -U pacagen -d pacagen_hub_prod < backup.sql

# Check disk space
df -h
docker system df
```

---

## 📚 Additional Resources

- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Don%27t_Do_This)

---

## 🆘 Getting Help

1. Check this documentation first
2. Review error logs: `docker-compose logs -f`
3. Ask team members
4. Check project README and other docs

---

**Last Updated:** 2025-10-24
**Maintained By:** Development Team



cat > docker-compose.yml << 'EOF'
  version: '3.8'

  services:
    gitlab:
      image: gitlab/gitlab-ce:latest
      container_name: gitlab
      restart: always
      hostname: 'gitlab.yourdomain.com'  # 修改为你的域名或 IP
      environment:
        GITLAB_OMNIBUS_CONFIG: |
          # =====================================================
          # 基础配置
          # =====================================================
          # 外部访问 URL（重要！）
          # external_url 'http://gitlab.yourdomain.com'
          # 如果没有域名，使用 IP:
          external_url 'http://13.58.81.237'

          # GitLab Shell SSH 端口（避免与系统 SSH 冲突）
          gitlab_rails['gitlab_shell_ssh_port'] = 2222

          # =====================================================
          # 性能优化（针对 t3.medium 4GB RAM）
          # =====================================================
          # Puma（Web 服务器）
          puma['worker_processes'] = 2
          puma['min_threads'] = 1
          puma['max_threads'] = 4

          # Sidekiq（后台任务）
          sidekiq['max_concurrency'] = 10

          # PostgreSQL 优化
          postgresql['shared_buffers'] = "256MB"
          postgresql['max_worker_processes'] = 8
          postgresql['max_connections'] = 100

          # Redis 优化
          redis['maxmemory'] = '256mb'

          # Gitaly（Git 存储）
          gitaly['concurrency'] = [
            {
              'rpc' => "/gitaly.SmartHTTPService/PostReceivePack",
              'max_per_repo' => 3
            },
            {
              'rpc' => "/gitaly.SSHService/SSHUploadPack",
              'max_per_repo' => 3
            }
          ]

          # =====================================================
          # Container Registry（可选）
          # =====================================================
          registry_external_url 'http://gitlab.yourdomain.com:5005'
          # 如果使用 IP:
          # registry_external_url 'http://YOUR_EC2_IP:5005'

          # =====================================================
          # CI/CD Runners
          # =====================================================
          gitlab_rails['gitlab_default_projects_features_builds'] = true

          # =====================================================
          # 邮件配置（可选，用于通知）
          # =====================================================
          # 使用 Gmail SMTP
          # gitlab_rails['smtp_enable'] = true
          # gitlab_rails['smtp_address'] = "smtp.gmail.com"
          # gitlab_rails['smtp_port'] = 587
          # gitlab_rails['smtp_user_name'] = "your-email@gmail.com"
          # gitlab_rails['smtp_password'] = "your-app-password"
          # gitlab_rails['smtp_domain'] = "smtp.gmail.com"
          # gitlab_rails['smtp_authentication'] = "login"
          # gitlab_rails['smtp_enable_starttls_auto'] = true
          # gitlab_rails['smtp_tls'] = false
          # gitlab_rails['gitlab_email_from'] = 'your-email@gmail.com'
          # gitlab_rails['gitlab_email_reply_to'] = 'noreply@gmail.com'

          # =====================================================
          # 备份配置
          # =====================================================
          gitlab_rails['backup_keep_time'] = 604800  # 7 天
          gitlab_rails['backup_path'] = "/var/opt/gitlab/backups"

          # =====================================================
          # 监控和日志
          # =====================================================
          prometheus_monitoring['enable'] = true
          grafana['enable'] = false  # 节省资源

          # =====================================================
          # 时区
          # =====================================================
          gitlab_rails['time_zone'] = 'Asia/Shanghai'

      ports:
        - '80:80'        # HTTP
        - '443:443'      # HTTPS
        - '2222:22'      # GitLab SSH
        - '5005:5005'    # Container Registry
      volumes:
        # 使用命名卷（推荐）
        - gitlab_config:/etc/gitlab
        - gitlab_logs:/var/log/gitlab
        - gitlab_data:/var/opt/gitlab

        # 或使用本地目录（方便备份）
        # - ./config:/etc/gitlab
        # - ./logs:/var/log/gitlab
        # - ./data:/var/opt/gitlab
      shm_size: '256m'

      # 健康检查
      healthcheck:
        test: ["CMD", "/opt/gitlab/bin/gitlab-healthcheck", "--fail"]
        interval: 60s
        timeout: 30s
        retries: 5
        start_period: 5m

      # 资源限制
      deploy:
        resources:
          limits:
            memory: 4G
            cpus: '2.0'
          reservations:
            memory: 3G
            cpus: '1.0'

  volumes:
    gitlab_config:
      driver: local
    gitlab_logs:
      driver: local
    gitlab_data:
      driver: local

  networks:
    default:
      name: gitlab_network