'use client'

import React from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { VariantComparison } from '@/lib/analytics/types'

interface MetricComparisonChartProps {
  variants: VariantComparison[]
  metricKey: keyof Pick<
    VariantComparison,
    'conversion_rate' | 'revenue_per_visitor' | 'profit_per_visitor' | 'avg_order_value'
  >
  title: string
  valueFormatter?: (value: number) => string
}

/**
 * 指标对比柱状图组件
 * 参考 Intelligem 设计，显示各变体的指标对比
 */
export function MetricComparisonChart({
  variants,
  metricKey,
  title,
  valueFormatter = (v) => v.toFixed(2),
}: MetricComparisonChartProps) {
  const option: EChartsOption = {
    title: {
      text: title,
      left: 'left',
      textStyle: {
        fontSize: 16,
        fontWeight: 'normal',
      },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
      formatter: (params: any) => {
        const dataPoint = params[0]
        const variant = variants[dataPoint.dataIndex]
        const value = valueFormatter(dataPoint.value)
        const change = variant.is_control
          ? ''
          : `<br/>vs Control: <span style="color: ${variant[`${metricKey}_change` as keyof VariantComparison] as number > 0 ? '#10b981' : '#ef4444'}">${(variant[`${metricKey}_change` as keyof VariantComparison] as number > 0 ? '+' : '')}${(variant[`${metricKey}_change` as keyof VariantComparison] as number).toFixed(2)}%</span>`
        return `
          <div style="padding: 8px">
            <strong>${variant.variant_name}</strong><br/>
            ${title}: ${value}${change}
          </div>
        `
      },
    },
    xAxis: {
      type: 'category',
      data: variants.map((v) => v.variant_name),
      axisTick: {
        alignWithLabel: true,
      },
    },
    yAxis: {
      type: 'value',
      name: title,
      axisLabel: {
        formatter: valueFormatter,
      },
    },
    series: [
      {
        name: title,
        type: 'bar',
        data: variants.map((v) => ({
          value: v[metricKey],
          itemStyle: {
            color: v.is_control ? '#3b82f6' : '#1e40af', // 控制组浅蓝，变体深蓝
          },
        })),
        barWidth: '60%',
        label: {
          show: true,
          position: 'top',
          formatter: (params: any) => valueFormatter(params.value),
        },
      },
    ],
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
  }

  return <ReactECharts option={option} style={{ height: '350px', width: '100%' }} />
}
