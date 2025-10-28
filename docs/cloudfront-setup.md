# AWS CloudFront CDN 配置指南

## 概述

为 PacagenHub A/B Testing API 配置 CloudFront CDN，实现全球低延迟访问。

**预期效果：**
- ✅ GET `/api/experiments/active` 延迟：200-300ms → **10-50ms**（全球）
- ✅ POST `/api/experiments/track/*` 延迟：200-300ms → **150-250ms**（小幅改善）
- 💰 成本：约 $5-10/月（取决于流量）

---

## 前置要求

- ✅ AWS 账号
- ✅ EC2 实例运行中（当前在 us-east-1）
- ✅ 域名（可选，推荐使用自定义域名）
- ✅ SSL 证书（如果使用 HTTPS + 自定义域名）

---

## 步骤 1：创建 CloudFront 分发

### 1.1 访问 CloudFront 控制台

1. 登录 AWS Console
2. 搜索并进入 **CloudFront** 服务
3. 点击 **Create Distribution**

### 1.2 配置 Origin（源站）

**Origin Domain:**
```
你的 EC2 公网 IP 或域名（如：testing.pacagen.com）
```

**Protocol:**
- 如果使用 HTTP: `HTTP only`
- 如果使用 HTTPS: `HTTPS only` 或 `Match viewer`

**Origin Path:** 留空

**Name:** `pacagen-hub-ec2`

**Add custom header（重要！）:**
```
Header name: X-Forwarded-Host
Value: testing.pacagen.com（你的真实域名）
```

这样可以让你的应用识别请求来自 CloudFront。

---

## 步骤 2：配置 Default Cache Behavior

### 2.1 基础设置

**Path Pattern:** `Default (*)`

**Compress objects automatically:** `Yes`（启用 Gzip/Brotli 压缩）

**Viewer Protocol Policy:**
- 推荐：`Redirect HTTP to HTTPS`

**Allowed HTTP Methods:**
```
GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
```
（必须选择完整方法，因为你有 POST 请求）

### 2.2 缓存策略（关键配置）

**Cache Policy:** `Create policy`（创建自定义策略）

#### 创建自定义缓存策略

**Name:** `PacagenHub-API-Cache`

**TTL Settings:**
```
Minimum TTL: 0 seconds
Maximum TTL: 86400 seconds (1 day)
Default TTL: 300 seconds (5 minutes)
```

**Cache Key Settings:**

**Headers:**
- Include: `X-AB-Test-Client`（用于识别 A/B test 客户端）
- Include: `Host`

**Query Strings:**
- All（包含所有查询参数）

**Cookies:**
- None（不根据 cookie 缓存）

#### Origin Request Policy

**Name:** `PacagenHub-Origin-Request`

**Headers:**
- Include: `X-AB-Test-Client`
- Include: `Origin`
- Include: `Access-Control-Request-Method`
- Include: `Access-Control-Request-Headers`

**Query Strings:** All

---

## 步骤 3：配置特定路径的缓存行为（可选，推荐）

为不同 API 路径设置不同缓存策略。

### 3.1 创建 `/api/experiments/active` 行为

**Path Pattern:** `/api/experiments/active`

**Cache Policy:**
```
Minimum TTL: 60 seconds
Maximum TTL: 600 seconds
Default TTL: 300 seconds
```

**Response Headers Policy:** `SimpleCORS`（如果需要跨域）

### 3.2 创建 `/api/experiments/track/*` 行为

**Path Pattern:** `/api/experiments/track/*`

**Cache Policy:** `CachingDisabled`（POST 请求不缓存）

**Origin Request Policy:** `AllViewer`（转发所有请求头）

---

## 步骤 4：配置额外设置

### 4.1 Settings（分发设置）

**Price Class:**
- 推荐：`Use all edge locations (best performance)`
- 预算有限：`Use only North America and Europe`

**Alternate Domain Names (CNAMEs):**
```
api.pacagen.com（你的自定义 API 域名）
```

**SSL Certificate:**
- 使用自定义域名：`Custom SSL Certificate`（需要在 ACM 申请证书）
- 使用 CloudFront 域名：`Default CloudFront Certificate`

**Supported HTTP Versions:**
```
HTTP/2, HTTP/3
```

### 4.2 Error Pages（可选）

创建自定义错误响应：

**HTTP Error Code:** `502, 503, 504`
**Response Page Path:** `/`
**HTTP Response Code:** `200`
**TTL:** `0`（不缓存错误）

---

## 步骤 5：创建分发并等待部署

1. 点击 **Create Distribution**
2. 等待状态变为 **Deployed**（约 15-20 分钟）
3. 记录分发域名：`d1234567890abc.cloudfront.net`

---

## 步骤 6：配置 DNS（如果使用自定义域名）

### 6.1 在你的 DNS 提供商创建 CNAME 记录

```
Type: CNAME
Name: api（或 testing）
Value: d1234567890abc.cloudfront.net（你的 CloudFront 域名）
TTL: 300
```

### 6.2 验证 DNS 生效

```bash
dig api.pacagen.com
# 或
nslookup api.pacagen.com
```

---

## 步骤 7：测试验证

### 7.1 测试缓存是否生效

```bash
# 第一次请求（MISS）
curl -I https://api.pacagen.com/api/experiments/active

# 查看响应头
X-Cache: Miss from cloudfront

# 第二次请求（HIT）
curl -I https://api.pacagen.com/api/experiments/active

# 响应头应该显示
X-Cache: Hit from cloudfront
Age: 10（已缓存的秒数）
```

### 7.2 测试全球延迟

使用在线工具测试：
- https://www.dotcom-tools.com/website-speed-test.aspx
- https://tools.pingdom.com/

### 7.3 测试 A/B Test 客户端请求

```bash
curl -H "X-AB-Test-Client: headless-storefront" \
     https://api.pacagen.com/api/experiments/active
```

应该正常返回数据。

---

## 高级配置（可选）

### 选项 1：Lambda@Edge 实现智能路由

创建 Lambda 函数在边缘节点处理请求：

```javascript
// viewer-request.js
exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  const headers = request.headers;

  // 为 A/B test 客户端添加特殊处理
  if (headers['x-ab-test-client'] &&
      headers['x-ab-test-client'][0].value === 'headless-storefront') {
    // 可以在这里添加自定义逻辑
  }

  return request;
};
```

### 选项 2：启用 Real-time Logs

监控 API 访问情况：

1. 创建 Kinesis Data Stream
2. 在 CloudFront 分发设置中启用 Real-time logs
3. 配置字段：`timestamp, c-ip, cs-method, cs-uri-stem, sc-status, time-taken`

---

## 监控和优化

### CloudWatch 指标

关注以下指标：
- **CacheHitRate**（缓存命中率）- 目标 >60%
- **OriginLatency**（回源延迟）- 应该 <200ms
- **4xxErrorRate / 5xxErrorRate**（错误率）- 应该 <1%

### 成本优化

**当前配置预估成本：**
```
数据传输：10GB/月 × $0.085/GB = $0.85
请求数：100万次/月 × $0.0075/10000次 = $0.75
总计：约 $1.6/月（轻量使用）
```

**如果流量增大（100GB/月）：**
```
数据传输：100GB × $0.085 = $8.5
请求数：1000万次 × $0.0075/10000 = $7.5
总计：约 $16/月
```

---

## 故障排查

### 问题 1：缓存未生效（X-Cache: Miss）

**检查清单：**
- ✅ Cache Policy TTL 设置正确
- ✅ API 返回了 `Cache-Control` 响应头
- ✅ 请求 URL 完全一致（包括查询参数）

### 问题 2：POST 请求被缓存

**解决方案：**
- 确保 POST 路径使用了 `CachingDisabled` 策略
- 或者在 API 返回 `Cache-Control: no-cache`

### 问题 3：CORS 错误

**解决方案：**
1. 在 CloudFront Behavior 添加 Response Headers Policy
2. 或者在 Origin（Next.js）配置 CORS 头

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

  return response
}
```

---

## 回滚计划

如果 CloudFront 出现问题，可以快速回滚：

1. **DNS 切换：** 将 CNAME 指向原始 EC2 IP
2. **CloudFront 禁用：** 在控制台 Disable 分发
3. **完全删除：** Delete 分发（需要先 Disable）

---

## 下一步优化（未来）

如果 CloudFront 效果不够好，可以考虑：

### 选项 1：AWS Global Accelerator
- 成本：$25/月起
- 效果：POST 请求延迟降低 60%

### 选项 2：多区域部署
- 成本：$100+/月
- 效果：每个地区 <50ms 延迟

### 选项 3：迁移到 Vercel Edge
- 成本：$20/月（Pro 版）
- 效果：GET/POST 都在 20-80ms

---

## 总结

完成以上配置后，你的 A/B Testing API 将具备：

✅ **全球低延迟访问**（GET 请求 10-50ms）
✅ **高可用性**（CloudFront 自动故障转移）
✅ **成本优化**（CDN 缓存减少源站负载）
✅ **安全性**（DDoS 防护、SSL 加密）

**预计配置时间：** 30-45 分钟（首次配置）

有问题随时问我！🚀
