# Docker 磁盘空间优化指南

## 问题描述

当频繁运行 `docker compose -f docker-compose.prod.yml up -d --build` 时，Docker 会累积大量缓存、旧镜像和日志，导致 20GB 磁盘空间被耗尽。

**常见占用原因：**
- ✅ Docker 构建缓存（每次构建都会留下层）
- ✅ 旧的镜像版本没有清理
- ✅ 停止的容器占用空间
- ✅ 容器日志文件过大
- ✅ 未使用的 volumes

---

## 🚨 紧急清理（立即释放空间）

### 方法 1：使用我们的清理脚本（推荐）

```bash
# SSH 到服务器
cd /path/to/pacagen-hub

# 给脚本执行权限
chmod +x scripts/docker-cleanup.sh

# 运行清理
sudo bash scripts/docker-cleanup.sh
```

**预计释放：** 10-15GB

---

### 方法 2：手动清理（如果脚本不可用）

```bash
# 1. 停止所有容器
docker compose -f docker-compose.prod.yml down

# 2. 删除所有悬空镜像和容器
docker system prune -a -f

# 3. 删除构建缓存
docker builder prune -a -f

# 4. 删除未使用的 volumes（小心！会删除数据）
docker volume prune -f

# 5. 清理容器日志
sudo sh -c "truncate -s 0 /var/lib/docker/containers/*/*-json.log"

# 6. 重启 Docker daemon
sudo systemctl restart docker
```

**预计释放：** 15-18GB

---

## 📋 诊断命令（查看占用详情）

```bash
# 查看总体磁盘使用
df -h

# 查看 Docker 磁盘使用（简要）
docker system df

# 查看 Docker 磁盘使用（详细）
docker system df -v

# 查看 /var/lib/docker 下各目录大小
sudo du -sh /var/lib/docker/*

# 查看最大的容器日志
sudo find /var/lib/docker/containers/ -name "*-json.log" -exec ls -lh {} \; | sort -k5 -hr | head -10
```

---

## 🔧 长期解决方案

### 1. 配置 Docker Daemon 自动清理（强烈推荐）

这是**最重要的**配置，会自动限制日志大小和清理旧缓存。

```bash
# 备份现有配置
sudo cp /etc/docker/daemon.json /etc/docker/daemon.json.backup 2>/dev/null || true

# 使用我们的配置模板
sudo cp scripts/docker-daemon.json /etc/docker/daemon.json

# 重启 Docker 使配置生效
sudo systemctl restart docker

# 验证配置
docker info | grep -A 5 "Log"
```

**配置说明：**
- **日志限制：** 每个容器最多 3 个日志文件，每个 10MB
- **自动压缩：** 旧日志自动压缩节省空间
- **构建缓存：** 自动清理 24 小时未使用的缓存
- **最大缓存：** 构建缓存不超过 2GB

---

### 2. 使用自动化部署脚本（推荐）

不再手动执行 `docker compose`，使用我们的部署脚本：

```bash
# 给脚本执行权限
chmod +x scripts/deploy.sh

# 自动清理 + 部署
./scripts/deploy.sh
```

**脚本会自动：**
1. ✅ 检查磁盘空间
2. ✅ 拉取最新代码（可选）
3. ✅ 清理旧镜像和缓存
4. ✅ 构建新镜像
5. ✅ 部署应用
6. ✅ 显示状态和日志命令

---

### 3. 设置定时清理（可选）

使用 cron 定期自动清理：

```bash
# 编辑 crontab
crontab -e

# 添加以下行（每周日凌晨 3 点清理）
0 3 * * 0 cd /path/to/pacagen-hub && bash scripts/docker-cleanup.sh > /tmp/docker-cleanup.log 2>&1
```

---

## 🎯 最佳实践（日常使用）

### ✅ 推荐做法

```bash
# 方式 1：使用自动化部署脚本（最推荐）
./scripts/deploy.sh

# 方式 2：手动部署前先清理
bash scripts/docker-cleanup.sh
docker compose -f docker-compose.prod.yml up -d --build
```

### ❌ 避免做法

```bash
# 不要频繁使用 --no-cache（会累积更多缓存）
docker compose build --no-cache

# 不要不清理就反复构建
# 这样会累积大量旧镜像
```

---

## 📊 空间使用监控

### 定期检查（建议每周）

```bash
# 查看磁盘使用
df -h | grep -E '^Filesystem|/$'

# 查看 Docker 使用
docker system df

# 如果 Docker 使用超过 5GB，运行清理
if [ $(docker system df --format '{{.Size}}' | grep -oE '[0-9]+' | head -1) -gt 5 ]; then
  echo "Docker 占用过高，建议清理"
  bash scripts/docker-cleanup.sh
fi
```

---

## 🛠️ 故障排查

### 问题 1：清理后空间还是不够

**可能原因：** volumes 占用太多空间

```bash
# 查看所有 volumes
docker volume ls

# 查看 volumes 大小
docker system df -v | grep -A 20 "Local Volumes"

# 删除未使用的 volumes（小心！）
docker volume prune -f
```

---

### 问题 2：无法删除镜像（正在使用）

```bash
# 先停止所有容器
docker compose -f docker-compose.prod.yml down

# 强制删除所有镜像
docker rmi -f $(docker images -q)

# 重新部署
./scripts/deploy.sh
```

---

### 问题 3：/var/lib/docker 占用过大

```bash
# 查看具体占用
sudo du -sh /var/lib/docker/*

# 通常是 overlay2（镜像层）或 containers（日志）
# 如果是 containers，清理日志：
sudo sh -c "truncate -s 0 /var/lib/docker/containers/*/*-json.log"

# 如果是 overlay2，需要清理镜像：
docker system prune -a -f
```

---

## 📈 预期空间使用（配置后）

### 正常运行状态

```
总磁盘空间：20GB
系统占用：   ~3GB
PostgreSQL:  ~1GB（数据 + 日志）
Next.js:     ~500MB（镜像）
构建缓存：   ~1GB（自动控制）
日志文件：   ~100MB（自动限制）
可用空间：   ~14GB
```

### 极端情况（多次构建）

```
多次构建累积：~2-3GB
清理后恢复：  ~14GB 可用
```

---

## 🚀 快速参考

### 常用命令速查

```bash
# 查看空间
df -h && docker system df

# 立即清理
sudo bash scripts/docker-cleanup.sh

# 自动化部署
./scripts/deploy.sh

# 查看日志
docker logs -f pacagen_hub_app_prod

# 停止服务
docker compose -f docker-compose.prod.yml down

# 重启服务
docker compose -f docker-compose.prod.yml restart
```

---

## ✅ 检查清单

完成以下配置，确保长期稳定：

- [ ] 已配置 `/etc/docker/daemon.json`（日志和缓存限制）
- [ ] 已重启 Docker daemon
- [ ] 已给 `scripts/*.sh` 执行权限
- [ ] 已运行一次 `docker-cleanup.sh`
- [ ] 当前可用空间 > 10GB
- [ ] 已将 `deploy.sh` 加入部署流程
- [ ] 已设置 cron 定时清理（可选）

---

## 📞 帮助

如果按照以上步骤操作后仍有问题：

1. 运行诊断命令收集信息
2. 检查是否有其他服务占用磁盘
3. 考虑升级服务器磁盘容量（如果持续不够用）

**预期效果：**
- ✅ 立即释放 10-15GB 空间
- ✅ 长期保持 10-14GB 可用空间
- ✅ 无需手动清理

🎉 配置完成后，20GB 磁盘完全够用！
