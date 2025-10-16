# Hydrogen Integration Guide

## 概述

现在你已经在 PacagenHub 创建了实验，下一步是在 Hydrogen storefront 中集成这些实验。

## 架构流程

```
User Request → Hydrogen Loader → Fetch Active Experiments from Supabase
              ↓
            Assign Variant (hash-based)
              ↓
            Set Cookies
              ↓
            Render Correct Variant (SSR)
              ↓
            Zero Flicker! ✅
```

## 步骤 1: 在 Hydrogen 项目中添加 Supabase 客户端

### 安装依赖

```bash
cd /Users/xuyuquan/Desktop/code/headless
npm install @supabase/supabase-js
```

### 创建 Supabase 客户端

**文件**: `app/lib/supabase.server.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

// 使用相同的 Supabase 项目
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// 获取活跃的实验
export async function getActiveExperiments() {
  const { data: experiments, error } = await supabase
    .from('experiments')
    .select(`
      *,
      variants!variants_experiment_id_fkey (*)
    `)
    .eq('status', 'running')

  if (error) {
    console.error('Error fetching experiments:', error)
    return []
  }

  return experiments || []
}

// 根据实验 ID 获取特定实验
export async function getExperimentById(experimentId: string) {
  const { data: experiment, error } = await supabase
    .from('experiments')
    .select(`
      *,
      variants!variants_experiment_id_fkey (*)
    `)
    .eq('id', experimentId)
    .eq('status', 'running')
    .single()

  if (error) {
    console.error('Error fetching experiment:', error)
    return null
  }

  return experiment
}
```

### 添加环境变量

**文件**: `.env` (在 headless 项目中)

```env
# 添加这些行（使用与 pacagen-hub 相同的值）
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

## 步骤 2: 更新现有的 A/B 测试逻辑

你已经有了 `serverABTest.ts` 和 `ABTestWrapper.tsx`，现在需要从 Supabase 获取实验配置。

### 更新 serverABTest.ts

**文件**: `app/lib/abtest/serverABTest.ts`

```typescript
import { getExperimentById } from '../supabase.server'

/**
 * 从 Supabase 获取实验配置并分配变体
 */
export async function getExperimentVariant(
  request: Request,
  experimentId: string
): Promise<{ variant: string; userId: string } | null> {
  // 1. 从 Supabase 获取实验配置
  const experiment = await getExperimentById(experimentId)

  if (!experiment || !experiment.variants || experiment.variants.length < 2) {
    console.warn(`Experiment ${experimentId} not found or invalid`)
    return null
  }

  // 2. 检查是否已有 cookie 分配
  const existingVariant = getABTestVariant(request, experimentId)
  const { userId } = getUserId(request)

  if (existingVariant) {
    return { variant: existingVariant, userId }
  }

  // 3. 转换为 ABTestConfig 格式
  const config: ABTestConfig = {
    id: experiment.id,
    name: experiment.name,
    variants: experiment.variants.map((v: any) => ({
      id: v.id,
      name: v.name,
      weight: v.weight,
    })),
    traffic: 100, // 可以从 experiment.traffic_allocation 获取
  }

  // 4. 分配新变体
  const assignment = assignVariant(request, config)

  return {
    variant: assignment.variant,
    userId: assignment.userId,
  }
}

// 保留原有的 helper 函数
// getABTestVariant, assignVariant, setABTestCookie, etc.
```

## 步骤 3: 在产品页面中使用

### 示例：产品页 CTA 按钮测试

**文件**: `app/routes/($locale).products.$handle.tsx`

```typescript
import { json, type LoaderFunctionArgs } from '@shopify/remix-oxygen'
import { useLoaderData } from '@remix-run/react'
import { ABTestWrapper } from '~/components/abtest'
import { getExperimentVariant, setABTestCookie, setUserIdCookie } from '~/lib/abtest/serverABTest'

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const { handle } = params
  const { storefront } = context

  // 获取产品数据
  const { product } = await storefront.query(PRODUCT_QUERY, {
    variables: { handle },
  })

  // 🔥 从 Supabase 获取 A/B 测试变体
  const experimentId = 'your-experiment-id-from-dashboard' // 或动态获取
  const abTest = await getExperimentVariant(request, experimentId)

  // 设置 cookies
  const headers = new Headers()
  if (abTest) {
    setABTestCookie(headers, experimentId, abTest.variant)
    setUserIdCookie(headers, abTest.userId)
  }

  return json(
    {
      product,
      abTest: {
        experimentId,
        variant: abTest?.variant || 'control',
        userId: abTest?.userId,
      }
    },
    { headers }
  )
}

export default function ProductPage() {
  const { product, abTest } = useLoaderData<typeof loader>()

  return (
    <div>
      <h1>{product.title}</h1>

      {/* A/B 测试：CTA 按钮 */}
      <ABTestWrapper variant={abTest.variant}>
        {(variant) => {
          if (variant === 'variant_a') {
            return (
              <button className="bg-green-500 text-white px-6 py-3 rounded-lg">
                立即购买 - 限时优惠！
              </button>
            )
          }

          // Control
          return (
            <button className="bg-blue-500 text-white px-6 py-3 rounded-lg">
              加入购物车
            </button>
          )
        }}
      </ABTestWrapper>
    </div>
  )
}
```

## 步骤 4: 动态获取实验 ID

为了避免硬编码实验 ID，你可以：

### 方案 A: 通过页面路径匹配

**文件**: `app/lib/abtest/experiments.server.ts`

```typescript
import { getActiveExperiments } from '../supabase.server'

/**
 * 根据当前 URL 获取适用的实验
 */
export async function getExperimentsForPage(url: string) {
  const experiments = await getActiveExperiments()

  // 匹配 targeting_rules
  return experiments.filter((exp) => {
    const rules = exp.targeting_rules as any

    // 如果没有规则，应用到所有页面
    if (!rules || !rules.url_patterns) return true

    // 检查 URL 是否匹配
    return rules.url_patterns.some((pattern: string) => {
      const regex = new RegExp(pattern.replace('*', '.*'))
      return regex.test(url)
    })
  })
}
```

### 方案 B: 通过产品标签

在 PacagenHub 中设置 `targeting_rules`:

```json
{
  "product_handles": ["specific-product-handle"],
  "collections": ["featured-products"]
}
```

然后在 loader 中匹配：

```typescript
const experiments = await getActiveExperiments()
const matchingExp = experiments.find((exp) => {
  const rules = exp.targeting_rules as any
  return rules?.product_handles?.includes(handle)
})
```

## 步骤 5: 追踪事件（可选但推荐）

### 追踪曝光 (Exposure)

```typescript
// app/lib/abtest/tracking.server.ts
import { supabase } from '../supabase.server'

export async function trackExposure(
  userId: string,
  experimentId: string,
  variantId: string,
  context?: Record<string, any>
) {
  await supabase.from('events').insert({
    event_type: 'exposure',
    user_id: userId,
    experiment_id: experimentId,
    variant_id: variantId,
    event_data: context || {},
    url: context?.url,
    user_agent: context?.userAgent,
  })
}
```

### 在 Loader 中调用

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const abTest = await getExperimentVariant(request, experimentId)

  if (abTest) {
    // 追踪曝光
    await trackExposure(
      abTest.userId,
      experimentId,
      abTest.variantId, // 需要从实验中获取
      {
        url: new URL(request.url).pathname,
        userAgent: request.headers.get('User-Agent'),
      }
    )
  }

  // ...
}
```

## 步骤 6: 测试集成

### 测试清单

1. **启动 Hydrogen 开发服务器**
   ```bash
   cd /Users/xuyuquan/Desktop/code/headless
   npm run dev
   ```

2. **访问测试页面**
   - 打开浏览器
   - 访问包含 A/B 测试的页面
   - 刷新多次，检查 cookie

3. **验证 Cookie**
   - 打开浏览器开发者工具
   - Application → Cookies
   - 应该看到：
     - `abtest_uid` (用户 ID)
     - `abtest_[experiment-id]` (变体名称)

4. **验证无闪烁**
   - 刷新页面多次
   - 应该立即看到正确的变体
   - 没有任何视觉闪烁

5. **检查数据库**
   - 回到 Supabase
   - 查看 `events` 表
   - 应该看到 exposure 事件

## 完整示例：产品 CTA 测试

假设你在 PacagenHub 创建了一个实验：

- **名称**: "Product CTA Test"
- **ID**: `abc-123-def-456`
- **变体**:
  - Control: "加入购物车" (蓝色按钮)
  - Variant A: "立即购买" (绿色按钮)

### 1. 在 Hydrogen 中实现

```typescript
// app/routes/($locale).products.$handle.tsx
export async function loader({ request }: LoaderFunctionArgs) {
  const abTest = await getExperimentVariant(request, 'abc-123-def-456')

  const headers = new Headers()
  if (abTest) {
    setABTestCookie(headers, 'abc-123-def-456', abTest.variant)
    setUserIdCookie(headers, abTest.userId)
  }

  return json({ abTest }, { headers })
}

export default function Product() {
  const { abTest } = useLoaderData<typeof loader>()

  return (
    <ABTestWrapper variant={abTest?.variant || 'control'}>
      {(variant) => (
        <button className={variant === 'variant_a' ? 'btn-green' : 'btn-blue'}>
          {variant === 'variant_a' ? '立即购买' : '加入购物车'}
        </button>
      )}
    </ABTestWrapper>
  )
}
```

### 2. 测试步骤

1. 在 PacagenHub 中启动实验（状态改为 "Running"）
2. 访问产品页面
3. 刷新多次，看到不同的按钮变体
4. 检查 Supabase `events` 表，看到追踪数据

### 3. 查看结果

- 回到 PacagenHub
- 进入实验详情页
- 查看统计数据（未来功能）

## 进阶功能

### 多页面实验

```typescript
// 在多个页面应用同一个实验
const experiments = await getExperimentsForPage(request.url)

experiments.forEach(async (exp) => {
  const variant = await getExperimentVariant(request, exp.id)
  // Apply variant...
})
```

### 排除 Bot 流量

```typescript
import { isbot } from 'isbot'

export async function loader({ request }: LoaderFunctionArgs) {
  const userAgent = request.headers.get('User-Agent')

  if (isbot(userAgent)) {
    // 不分配变体给 bot
    return json({ abTest: null })
  }

  // 正常分配
  const abTest = await getExperimentVariant(request, experimentId)
  // ...
}
```

## 总结

✅ **你现在需要做的**：

1. 在 headless 项目安装 `@supabase/supabase-js`
2. 创建 `supabase.server.ts` 文件
3. 添加 Supabase 环境变量
4. 更新产品页面 loader，从 Supabase 获取实验
5. 使用现有的 `ABTestWrapper` 渲染变体
6. 测试并验证无闪烁

**预期结果**：
- ✅ 从 PacagenHub 动态获取实验配置
- ✅ 服务端分配变体（零闪烁）
- ✅ Cookie 持久化用户分配
- ✅ （可选）追踪曝光和转化事件

**下一步**：开始在 headless 项目中实现集成！

需要我帮你创建具体的代码文件吗？
