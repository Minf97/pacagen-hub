import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ExperimentWithVariants } from '@/lib/supabase/types'
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
    const supabase = await createClient()

    // 1. 获取实验基本信息和变体
    const { data: experiment, error: experimentError } = await supabase
      .from('experiments')
      .select(`
        *,
        variants!variants_experiment_id_fkey (*)
      `)
      .eq('id', experimentId)
      .single()

    if (experimentError) throw experimentError
    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
    }

    // 类型断言：确保 variants 存在
    const experimentWithVariants = experiment as unknown as ExperimentWithVariants

    // 2. 获取聚合后的变体统计数据（数据库层聚合）
    const { data: variantTotals, error: totalsError } = await supabase.rpc(
      'get_variant_totals',
      { p_experiment_id: experimentId } as never
    )
    // console.log(JSON.stringify(variantTotals, null, 2), "variantTotals")

    if (totalsError) throw totalsError

    // 如果没有统计数据，返回空结构
    if (!variantTotals || (variantTotals as any[]).length === 0) {
      return NextResponse.json({
        summary: {
          experiment_id: experimentId,
          experiment_name: experimentWithVariants.name,
          status: experimentWithVariants.status,
          started_at: experimentWithVariants.started_at,
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
    const variantMetrics = experimentWithVariants.variants.map((variant) => {
      const totals = (variantTotals as any[]).find((t: any) => t.variant_id === variant.id)
      if (!totals) {
        return null
      }
      return aggregateVariantMetrics(
        {
          visitors: Number(totals.total_visitors),
          impressions: Number(totals.total_impressions),
          clicks: Number(totals.total_clicks),
          orders: Number(totals.total_orders),
          revenue: Number(totals.total_revenue),
        },
        variant
      )
    })

    // console.log(variantMetrics, "variantMetrics")

    // 4. 获取时间序列数据（用于趋势图）
    const { data: timeSeriesRows, error: timeSeriesError } = await supabase.rpc(
      'get_experiment_time_series',
      { p_experiment_id: experimentId } as never
    )

    if (timeSeriesError) throw timeSeriesError

    // 5. 找到控制组
    const controlMetrics = variantMetrics[0]

    // 6. 对比所有变体与控制组
    const variantComparisons = variantMetrics.map((metrics: any) =>
      compareVariantToControl(metrics, controlMetrics)
    )

    // 7. 聚合实验汇总数据
    const summary = aggregateExperimentSummary(
      experimentId,
      experimentWithVariants.name,
      experimentWithVariants.status,
      experimentWithVariants.started_at,
      variantComparisons
    )

    // console.log(summary, "summary")

    // 8. 转换时间序列数据 - 传入 variants 以获取 variant_name
    const time_series = aggregateTimeSeriesData(
      timeSeriesRows || [],
      experimentWithVariants.variants
    )

    return NextResponse.json({
      summary,
      time_series,
    })
  } catch (error) {
    console.error('Error fetching experiment stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch experiment stats' },
      { status: 500 }
    )
  }
}
