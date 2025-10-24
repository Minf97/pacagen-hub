/**
 * Analytics Aggregation Functions
 * 统计数据聚合函数 - 从原始 experiment_stats 数据聚合出完整指标
 */

import type { Variant } from '@/lib/db/schema'
import type {
  VariantMetrics,
  VariantComparison,
  ExperimentSummary,
  TimeSeriesDataPoint,
} from './types'
import {
  calculateConversionRate,
  calculateRevenuePerVisitor,
  calculateAvgOrderValue,
  calculateClickThroughRate,
  calculateRelativeChange,
  calculateZScore,
  calculatePValue,
  calculateConfidenceInterval,
  calculateMonthlyImpact,
} from './types'

type VariantRow = Variant

/**
 * 已聚合的变体指标数据（来自数据库）
 */
export interface AggregatedTotals {
  visitors: number
  impressions: number
  clicks: number
  orders: number
  revenue: number
}

/**
 * 时间序列数据行（来自数据库）
 */
export interface TimeSeriesRow {
  date: string
  variantId: string
  visitors: number
  impressions: number
  clicks: number
  orders: number
  revenue: string | number
}

/**
 * 从已聚合的总计计算变体指标
 *
 * 注意: 此函数接受数据库已聚合的数据，不再进行累加
 * 累加逻辑已移至数据库函数 get_variant_totals()
 *
 * @param totals - 数据库聚合后的总计
 * @param variant - 变体信息
 * @returns 包含计算指标的变体数据
 */
export function aggregateVariantMetrics(
  totals: AggregatedTotals,
  variant: VariantRow
): VariantMetrics {

  // 计算衍生指标
  const conversion_rate = calculateConversionRate(totals.orders, totals.visitors)
  const click_through_rate = calculateClickThroughRate(totals.clicks, totals.impressions)
  const revenue_per_visitor = calculateRevenuePerVisitor(totals.revenue, totals.visitors)
  const avg_order_value = calculateAvgOrderValue(totals.revenue, totals.orders)

  // 计算每访客利润 (假设成本是收入的60%，实际应从配置读取)
  const COST_RATIO = 0.60
  const profit = totals.revenue * (1 - COST_RATIO)
  const profit_per_visitor = totals.visitors > 0 ? profit / totals.visitors : 0

  // 统计显著性 (需要对比控制组数据，这里先返回 null)
  const confidence_level = null
  const p_value = null

  return {
    variant_id: variant.id,
    variant_name: variant.displayName,
    is_control: variant.isControl,

    visitors: totals.visitors,
    impressions: totals.impressions,
    clicks: totals.clicks,
    orders: totals.orders,
    conversions: totals.orders,
    revenue: totals.revenue,
    total_revenue: totals.revenue,

    conversion_rate,
    click_through_rate,
    revenue_per_visitor,
    profit_per_visitor,
    avg_order_value,

    confidence_level,
    p_value,
  }
}

/**
 * 对比变体与控制组，计算相对变化和统计显著性
 *
 * @param variantMetrics - 变体指标
 * @param controlMetrics - 控制组指标
 * @returns 包含对比数据的变体指标
 */
export function compareVariantToControl(
  variantMetrics: VariantMetrics,
  controlMetrics: VariantMetrics
): VariantComparison {
  // 计算相对变化
  const conversion_rate_change = calculateRelativeChange(
    variantMetrics.conversion_rate,
    controlMetrics.conversion_rate
  )

  const revenue_per_visitor_change = calculateRelativeChange(
    variantMetrics.revenue_per_visitor,
    controlMetrics.revenue_per_visitor
  )

  const profit_per_visitor_change = calculateRelativeChange(
    variantMetrics.profit_per_visitor,
    controlMetrics.profit_per_visitor
  )

  const avg_order_value_change = calculateRelativeChange(
    variantMetrics.avg_order_value,
    controlMetrics.avg_order_value
  )

  // 计算统计显著性 (如果不是控制组本身)
  let confidence_level = null
  let p_value = null

  if (!variantMetrics.is_control && variantMetrics.visitors > 0 && controlMetrics.visitors > 0) {
    const zScore = calculateZScore({
      sample_size: variantMetrics.visitors,
      baseline_rate: controlMetrics.conversion_rate / 100,
      variant_rate: variantMetrics.conversion_rate / 100,
      confidence_level: 0.95,
      minimum_detectable_effect: 0.05,
    })

    p_value = calculatePValue(zScore)
    confidence_level = (1 - p_value) * 100 // 转换为百分比
  }

  // 计算置信区间
  const [ci_lower, ci_upper] = calculateConfidenceInterval(
    variantMetrics.conversion_rate / 100,
    variantMetrics.visitors
  )

  // 预估月度影响 (假设平均每日访客数)
  const dailyVisitors = variantMetrics.visitors / 30 // 假设实验运行 30 天
  const estimated_monthly_orders = calculateMonthlyImpact(
    dailyVisitors,
    conversion_rate_change / 100,
    controlMetrics.conversion_rate / 100
  )

  const estimated_monthly_revenue = calculateMonthlyImpact(
    dailyVisitors,
    revenue_per_visitor_change / 100,
    controlMetrics.revenue_per_visitor
  )

  return {
    ...variantMetrics,
    conversion_rate_change,
    revenue_per_visitor_change,
    profit_per_visitor_change,
    avg_order_value_change,
    conversion_rate_ci_lower: ci_lower,
    conversion_rate_ci_upper: ci_upper,
    estimated_monthly_orders,
    estimated_monthly_revenue,
    confidence_level,
    p_value,
  }
}

/**
 * 聚合实验汇总数据
 *
 * @param experimentId - 实验 ID
 * @param experimentName - 实验名称
 * @param status - 实验状态
 * @param startedAt - 开始时间
 * @param variantComparisons - 所有变体的对比数据
 * @returns 实验汇总统计
 */
export function aggregateExperimentSummary(
  experimentId: string,
  experimentName: string,
  status: 'draft' | 'running' | 'paused' | 'completed' | 'archived',
  startedAt: string | null,
  variantComparisons: VariantComparison[]
): ExperimentSummary {
  // 找到控制组
  const control = variantComparisons[0]

  // 计算总体指标
  const total_visitors = variantComparisons.reduce((sum, v) => sum + v.visitors, 0)
  const total_orders = variantComparisons.reduce((sum, v) => sum + v.orders, 0)
  const total_revenue = variantComparisons.reduce((sum, v) => sum + v.revenue, 0)

  // 计算实验持续天数
  let duration_days = null
  if (startedAt) {
    const started = new Date(startedAt)
    const now = new Date()
    duration_days = Math.floor((now.getTime() - started.getTime()) / (1000 * 60 * 60 * 24))
  }

  // 找到表现最好的变体 (基于转化率)
  const variantsExcludingControl = variantComparisons.filter((v) => !v.is_control)
  let winning_variant_id = null
  let winning_variant_improvement = null
  let is_statistically_significant = false

  if (variantsExcludingControl.length > 0) {
    const winner = variantsExcludingControl.reduce((best, current) =>
      current.conversion_rate > best.conversion_rate ? current : best
    )

    winning_variant_id = winner.variant_id
    winning_variant_improvement = winner.conversion_rate_change
    is_statistically_significant = winner.p_value !== null && winner.p_value < 0.05
  }

  return {
    experiment_id: experimentId,
    experiment_name: experimentName,
    status,
    started_at: startedAt,
    duration_days,

    total_visitors,
    total_orders,
    total_revenue,

    control_conversion_rate: control.conversion_rate,
    control_revenue_per_visitor: control.revenue_per_visitor,
    control_avg_order_value: control.avg_order_value,

    variants: variantComparisons,

    winning_variant_id,
    winning_variant_improvement,
    is_statistically_significant,
  }
}

/**
 * 将时间序列数据行转换为图表数据格式
 *
 * @param timeSeriesRows - 数据库返回的时间序列数据
 * @param variants - 变体信息数组（用于获取 variant_name）
 * @returns 时间序列数据点数组
 */
export function aggregateTimeSeriesData(
  timeSeriesRows: TimeSeriesRow[],
  variants: VariantRow[]
): TimeSeriesDataPoint[] {
  // 创建 variant_id -> variant_name 的映射
  const variantNameMap = new Map(
    variants.map((v) => [v.id, v.displayName])
  )

  return timeSeriesRows.map((row) => ({
    date: row.date,
    variant_id: row.variantId,
    variant_name: variantNameMap.get(row.variantId),
    visitors: row.visitors,
    orders: row.orders,
    revenue: row.revenue,
    conversion_rate: calculateConversionRate(row.orders, row.visitors),
    revenue_per_visitor: calculateRevenuePerVisitor(row.revenue, row.visitors),
  }))
}

/**
 * 按日期分组时间序列数据
 *
 * 用于生成图表数据: x轴为日期，每个变体一条线
 *
 * @param timeSeriesData - 时间序列数据
 * @returns 按日期分组的数据
 */
export function groupTimeSeriesByDate(
  timeSeriesData: TimeSeriesDataPoint[]
): Record<string, Record<string, TimeSeriesDataPoint>> {
  const grouped: Record<string, Record<string, TimeSeriesDataPoint>> = {}

  timeSeriesData.forEach((point) => {
    if (!grouped[point.date]) {
      grouped[point.date] = {}
    }
    grouped[point.date][point.variant_id] = point
  })

  return grouped
}
