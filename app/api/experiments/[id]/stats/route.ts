import { NextRequest, NextResponse } from 'next/server'
import {
  getExperimentById,
  getVariantTotals,
  getExperimentTimeSeries,
  getVariantTotalsByDevice
} from '@/lib/db/queries'
import type { ExperimentWithVariants } from '@/lib/db/schema'
import {
  aggregateVariantMetrics,
  compareVariantToControl,
  aggregateExperimentSummary,
  aggregateTimeSeriesData,
} from '@/lib/analytics/aggregation'

/**
 * GET /api/experiments/[id]/stats
 *
 * 获取实验的完整统计数据
 *
 * 返回数据:
 * - 实验汇总信息
 * - 所有变体的指标对比
 * - 时间序列数据 (用于趋势图)
 * - 统计显著性分析
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: experimentId } = await params

    // 1. 获取实验基本信息和变体
    const experiment = await getExperimentById(experimentId)

    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
    }

    // 类型断言：确保 variants 存在
    const experimentWithVariants = experiment as ExperimentWithVariants

    // 2. 获取聚合后的变体统计数据（数据库层聚合）
    const variantTotals = await getVariantTotals(experimentId)

    // 如果没有统计数据，返回空结构
    if (!variantTotals || variantTotals.length === 0) {
      return NextResponse.json({
        summary: {
          experiment_id: experimentId,
          experiment_name: experimentWithVariants.name,
          status: experimentWithVariants.status,
          started_at: experimentWithVariants.startedAt,
          duration_days: null,
          total_visitors: 0,
          total_orders: 0,
          total_revenue: 0,
          control_conversion_rate: 0,
          control_revenue_per_visitor: 0,
          control_avg_order_value: 0,
          variants: [],
          winning_variant_id: null,
          winning_variant_improvement: null,
          is_statistically_significant: false,
        },
        time_series: [],
      })
    }

    // 3. 将数据库聚合结果与变体信息合并
    const variantMetrics = experimentWithVariants.variants
      .map((variant) => {
        const totals = variantTotals.find((t) => t.variantId === variant.id)
        if (!totals) {
          return null
        }
        return aggregateVariantMetrics(
          {
            visitors: Number(totals.totalVisitors),
            impressions: Number(totals.totalImpressions),
            clicks: Number(totals.totalClicks),
            orders: Number(totals.totalOrders),
            revenue: Number(totals.totalRevenue),
          },
          variant
        )
      })
      .filter((m): m is NonNullable<typeof m> => m !== null) // 过滤掉 null 值

    // 如果没有有效的指标数据，返回空结构
    if (variantMetrics.length === 0) {
      return NextResponse.json({
        summary: {
          experiment_id: experimentId,
          experiment_name: experimentWithVariants.name,
          status: experimentWithVariants.status,
          started_at: experimentWithVariants.startedAt,
          duration_days: null,
          total_visitors: 0,
          total_orders: 0,
          total_revenue: 0,
          control_conversion_rate: 0,
          control_revenue_per_visitor: 0,
          control_avg_order_value: 0,
          variants: [],
          winning_variant_id: null,
          winning_variant_improvement: null,
          is_statistically_significant: false,
        },
        time_series: [],
      })
    }

    // 4. 获取时间序列数据（用于趋势图）
    const timeSeriesRows = await getExperimentTimeSeries(experimentId)

    // 5. 找到控制组（第一个是控制组）
    const controlMetrics = variantMetrics.find(m => m.is_control) || variantMetrics[0]

    // 6. 对比所有变体与控制组
    const variantComparisons = variantMetrics.map((metrics) =>
      compareVariantToControl(metrics, controlMetrics)
    )

    // 7. 聚合实验汇总数据
    const summary = aggregateExperimentSummary(
      experimentId,
      experimentWithVariants.name,
      experimentWithVariants.status,
      experimentWithVariants.startedAt?.toISOString() || null,
      variantComparisons
    )

    // 8. 转换时间序列数据 - 传入 variants 以获取 variant_name
    const time_series = aggregateTimeSeriesData(
      timeSeriesRows || [],
      experimentWithVariants.variants
    )

    // 9. 获取设备分段数据 (Desktop/Mobile)
    const desktopTotals = await getVariantTotalsByDevice(experimentId, 'desktop')
    const mobileTotals = await getVariantTotalsByDevice(experimentId, 'mobile')

    // 10. 聚合设备分段指标
    const processDeviceSegment = (deviceTotals: typeof desktopTotals) => {
      const deviceMetrics = experimentWithVariants.variants
        .map((variant) => {
          const totals = deviceTotals.find((t) => t.variantId === variant.id)
          if (!totals) return null
          return aggregateVariantMetrics(
            {
              visitors: Number(totals.totalVisitors),
              impressions: Number(totals.totalImpressions),
              clicks: Number(totals.totalClicks),
              orders: Number(totals.totalOrders),
              revenue: Number(totals.totalRevenue),
            },
            variant
          )
        })
        .filter((m): m is NonNullable<typeof m> => m !== null)

      if (deviceMetrics.length === 0) return []

      const deviceControl = deviceMetrics.find(m => m.is_control) || deviceMetrics[0]
      return deviceMetrics.map((metrics) =>
        compareVariantToControl(metrics, deviceControl)
      )
    }

    const desktopVariants = processDeviceSegment(desktopTotals)
    const mobileVariants = processDeviceSegment(mobileTotals)

    return NextResponse.json({
      summary,
      time_series,
      segmentData: {
        desktop: desktopVariants,
        mobile: mobileVariants,
      },
    })
  } catch (error) {
    console.error('Error fetching experiment stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch experiment stats' },
      { status: 500 }
    )
  }
}
