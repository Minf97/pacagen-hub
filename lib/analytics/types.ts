/**
 * Analytics Types and Calculation Logic
 * Based on A/B Testing Best Practices
 */

/**
 * Core Metrics for Each Variant
 * 每个变体的核心指标
 */
export interface VariantMetrics {
  variant_id: string
  variant_name: string
  is_control: boolean

  // === 基础流量指标 ===
  visitors: number           // 访客数 (unique users)
  impressions: number        // 展示次数 (可重复)
  clicks: number            // 点击次数

  // === 转化指标 ===
  orders: number            // 订单数 (conversions)
  conversions: number       // 同 orders，转化次数

  // === 收入指标 ===
  revenue: number           // 总收入 (Net Revenue)
  total_revenue: number     // 同 revenue

  // === 计算指标 ===
  conversion_rate: number   // CVR = orders / visitors
  click_through_rate: number // CTR = clicks / impressions
  revenue_per_visitor: number // RPV = revenue / visitors
  profit_per_visitor: number  // Profit per Visitor (需要成本数据)
  avg_order_value: number   // AOV = revenue / orders

  // === 统计显著性 ===
  confidence_level: number | null  // 置信度 (0-100%)
  p_value: number | null          // p值 (统计显著性)
}

/**
 * Variant Comparison (对比控制组的相对变化)
 * 用于显示 "vs Control" 的百分比差异
 */
export interface VariantComparison extends VariantMetrics {
  // === 相对于控制组的变化 ===
  conversion_rate_change: number    // CVR 变化百分比
  revenue_per_visitor_change: number // RPV 变化百分比
  profit_per_visitor_change: number  // Profit 变化百分比
  avg_order_value_change: number    // AOV 变化百分比

  // === 置信区间 ===
  conversion_rate_ci_lower: number  // CVR 95% 置信区间下限
  conversion_rate_ci_upper: number  // CVR 95% 置信区间上限

  // === 预估影响 (Estimated Impact) ===
  estimated_monthly_orders: number   // 预估每月订单影响
  estimated_monthly_revenue: number  // 预估每月收入影响
}

/**
 * Experiment Summary Statistics
 * 实验汇总统计
 */
export interface ExperimentSummary {
  experiment_id: string
  experiment_name: string
  status: 'draft' | 'running' | 'paused' | 'completed' | 'archived'
  started_at: string | null
  duration_days: number | null

  // === 总体指标 ===
  total_visitors: number
  total_orders: number
  total_revenue: number

  // === 控制组基准 ===
  control_conversion_rate: number
  control_revenue_per_visitor: number
  control_avg_order_value: number

  // === 变体数据 ===
  variants: VariantComparison[]

  // === 获胜变体信息 ===
  winning_variant_id: string | null
  winning_variant_improvement: number | null // 相对控制组提升百分比
  is_statistically_significant: boolean     // 是否达到统计显著性
}

/**
 * Time Series Data Point
 * 时间序列数据点 (用于趋势图)
 */
export interface TimeSeriesDataPoint {
  date: string // ISO date string (YYYY-MM-DD)
  variant_id: string
  variant_name: string // Display name of the variant

  visitors: number
  orders: number
  revenue: number
  conversion_rate: number
  revenue_per_visitor: number
}

/**
 * Audience Segment Breakdown
 * 受众细分数据 (按设备/地区等维度拆分)
 */
export interface AudienceSegment {
  segment_type: 'device' | 'country' | 'source' | 'new_returning'
  segment_value: string // e.g., "Desktop", "Mobile", "US", "Direct"

  metrics_by_variant: {
    variant_id: string
    visitors: number
    orders: number
    revenue: number
    conversion_rate: number
  }[]
}

/**
 * Statistical Calculation Context
 * 统计计算上下文
 */
export interface StatisticalContext {
  sample_size: number           // 样本量
  baseline_rate: number         // 基准转化率 (控制组)
  variant_rate: number          // 变体转化率
  confidence_level: number      // 置信水平 (通常 95%)
  minimum_detectable_effect: number // 最小可检测效应 (MDE)
}

// ==========================================
// === 核心计算逻辑 (Algorithm Comments) ===
// ==========================================

/**
 * 计算转化率 (Conversion Rate)
 *
 * 公式: CVR = (订单数 / 访客数) × 100%
 *
 * @param orders - 订单数
 * @param visitors - 访客数
 * @returns 转化率百分比
 */
export function calculateConversionRate(orders: number, visitors: number): number {
  if (visitors === 0) return 0
  return (orders / visitors) * 100
}

/**
 * 计算每访客收入 (Revenue Per Visitor)
 *
 * 公式: RPV = 总收入 / 访客数
 *
 * @param revenue - 总收入
 * @param visitors - 访客数
 * @returns 每访客收入
 */
export function calculateRevenuePerVisitor(revenue: number, visitors: number): number {
  if (visitors === 0) return 0
  return revenue / visitors
}

/**
 * 计算平均订单价值 (Average Order Value)
 *
 * 公式: AOV = 总收入 / 订单数
 *
 * @param revenue - 总收入
 * @param orders - 订单数
 * @returns 平均订单价值
 */
export function calculateAvgOrderValue(revenue: number, orders: number): number {
  if (orders === 0) return 0
  return revenue / orders
}

/**
 * 计算点击率 (Click-Through Rate)
 *
 * 公式: CTR = (点击数 / 展示数) × 100%
 *
 * @param clicks - 点击数
 * @param impressions - 展示数
 * @returns 点击率百分比
 */
export function calculateClickThroughRate(clicks: number, impressions: number): number {
  if (impressions === 0) return 0
  return (clicks / impressions) * 100
}

/**
 * 计算相对变化百分比 (Relative Change)
 *
 * 公式: 变化% = ((变体值 - 控制值) / 控制值) × 100%
 *
 * 用于显示 "↑ +15%" 或 "↓ -8%" 这样的对比数据
 *
 * @param variantValue - 变体指标值
 * @param controlValue - 控制组指标值
 * @returns 变化百分比 (正数表示提升，负数表示下降)
 */
export function calculateRelativeChange(variantValue: number, controlValue: number): number {
  if (controlValue === 0) return 0
  return ((variantValue - controlValue) / controlValue) * 100
}

/**
 * 计算 Z 分数 (Z-Score) 用于统计显著性检验
 *
 * 基于两个比例的 Z 检验 (Two-Proportion Z-Test)
 *
 * 公式:
 * z = (p1 - p2) / √(p_pooled × (1 - p_pooled) × (1/n1 + 1/n2))
 *
 * 其中:
 * - p1 = 变体转化率
 * - p2 = 控制组转化率
 * - p_pooled = (x1 + x2) / (n1 + n2) // 合并比例
 * - n1, n2 = 样本量
 *
 * @param context - 统计计算上下文
 * @returns Z 分数
 */
export function calculateZScore(context: StatisticalContext): number {
  const { sample_size, baseline_rate, variant_rate } = context

  const p1 = variant_rate
  const p2 = baseline_rate
  const n1 = sample_size
  const n2 = sample_size // 假设样本量相等

  // 合并比例
  const x1 = p1 * n1
  const x2 = p2 * n2
  const pooledP = (x1 + x2) / (n1 + n2)

  // 标准误差
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / n1 + 1 / n2))

  if (se === 0) return 0

  return (p1 - p2) / se
}

/**
 * 计算 P 值 (P-Value)
 *
 * 基于 Z 分数计算双尾 P 值
 * P 值越小，说明结果越不可能由随机因素产生，统计显著性越高
 *
 * 通常标准:
 * - p < 0.05: 统计显著 (95% 置信度)
 * - p < 0.01: 高度显著 (99% 置信度)
 *
 * @param zScore - Z 分数
 * @returns P 值 (0-1 之间)
 */
export function calculatePValue(zScore: number): number {
  // 使用标准正态分布累积分布函数 (CDF)
  // 这里使用近似算法
  const absZ = Math.abs(zScore)

  // 误差函数近似
  const t = 1 / (1 + 0.2316419 * absZ)
  const d = 0.3989423 * Math.exp(-absZ * absZ / 2)
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))

  // 双尾检验
  return 2 * prob
}

/**
 * 计算置信区间 (Confidence Interval)
 *
 * 95% 置信区间计算
 * 公式: CI = p ± 1.96 × √(p(1-p)/n)
 *
 * @param proportion - 比例 (如转化率)
 * @param sampleSize - 样本量
 * @param confidenceLevel - 置信水平 (默认 0.95)
 * @returns [下限, 上限]
 */
export function calculateConfidenceInterval(
  proportion: number,
  sampleSize: number,
  confidenceLevel: number = 0.95
): [number, number] {
  if (sampleSize === 0) return [0, 0]

  // Z 值 (95% 对应 1.96, 99% 对应 2.576)
  const zValue = confidenceLevel === 0.95 ? 1.96 : 2.576

  // 标准误差
  const se = Math.sqrt((proportion * (1 - proportion)) / sampleSize)

  // 置信区间
  const lower = Math.max(0, proportion - zValue * se)
  const upper = Math.min(1, proportion + zValue * se)

  return [lower * 100, upper * 100] // 转换为百分比
}

/**
 * 计算所需样本量 (Sample Size Calculation)
 *
 * 基于预期效应大小和统计功效计算所需样本量
 *
 * 公式 (简化):
 * n = 2 × ((Zα + Zβ)² × p(1-p)) / (MDE²)
 *
 * 其中:
 * - Zα = 1.96 (95% 置信度)
 * - Zβ = 0.84 (80% 统计功效)
 * - p = 基准转化率
 * - MDE = 最小可检测效应
 *
 * @param baselineRate - 基准转化率
 * @param mde - 最小可检测效应 (如 0.05 表示 5%)
 * @param alpha - 显著性水平 (默认 0.05)
 * @param power - 统计功效 (默认 0.80)
 * @returns 每个变体所需样本量
 */
export function calculateRequiredSampleSize(
  baselineRate: number,
  mde: number,
  alpha: number = 0.05,
  power: number = 0.80
): number {
  const za = 1.96  // Z for alpha=0.05
  const zb = 0.84  // Z for power=0.80

  const p = baselineRate
  const numerator = 2 * Math.pow(za + zb, 2) * p * (1 - p)
  const denominator = Math.pow(mde, 2)

  return Math.ceil(numerator / denominator)
}

/**
 * 预估月度影响 (Estimated Monthly Impact)
 *
 * 基于实验期间的提升率，预估如果全量上线每月的影响
 *
 * 公式:
 * 月度影响 = 平均日流量 × 30 × 提升率
 *
 * @param dailyVisitors - 平均日访客数
 * @param improvementRate - 提升率 (如 0.15 表示 15%)
 * @param baselineMetric - 基准指标值 (如基准CVR或RPV)
 * @returns 预估月度影响值
 */
export function calculateMonthlyImpact(
  dailyVisitors: number,
  improvementRate: number,
  baselineMetric: number
): number {
  const monthlyVisitors = dailyVisitors * 30
  const improvedMetric = baselineMetric * (1 + improvementRate)
  const baselineTotal = monthlyVisitors * baselineMetric
  const improvedTotal = monthlyVisitors * improvedMetric

  return improvedTotal - baselineTotal
}
