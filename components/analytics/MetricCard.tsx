'use client'

import React from 'react'
import type { VariantComparison } from '@/lib/analytics/types'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { CalculationExplanation, type CalculationExplanationProps } from './CalculationExplanation'

interface MetricCardProps {
  variant: VariantComparison
  metricKey: keyof Pick<
    VariantComparison,
    'conversion_rate' | 'revenue_per_visitor' | 'profit_per_visitor' | 'avg_order_value'
  >
  title: string
  valueFormatter?: (value: number) => string
  estimateKey?: keyof Pick<VariantComparison, 'estimated_monthly_orders' | 'estimated_monthly_revenue'>
  estimateLabel?: string
  explanation?: CalculationExplanationProps
}

/**
 * 指标卡片组件
 * 参考 Intelligem 设计，显示单个指标的值、变化百分比和置信区间
 */
export function MetricCard({
  variant,
  metricKey,
  title,
  valueFormatter = (v) => v.toFixed(2),
  estimateKey,
  estimateLabel,
  explanation,
}: MetricCardProps) {
  const value = variant[metricKey] as number
  const changeKey = `${metricKey}_change` as keyof VariantComparison
  const change = variant[changeKey] as number

  const isControl = variant.is_control
  const isPositive = change > 0
  const isSignificant = variant.p_value !== null && variant.p_value < 0.05

  // 获取置信区间 (仅对转化率显示)
  const showCI = metricKey === 'conversion_rate'
  const ciLower = variant.conversion_rate_ci_lower
  const ciUpper = variant.conversion_rate_ci_upper

  return (
    <div className="border rounded-lg p-6 bg-white hover:shadow-md transition-shadow">
      {/* 标题 */}
      <div className="text-sm font-medium text-gray-600 mb-2 flex items-center">
        {title}
        {explanation && <CalculationExplanation {...explanation} />}
      </div>

      {/* 主指标值 */}
      <div className="flex items-baseline gap-2 mb-2">
        <div
          className={`text-3xl font-bold ${
            isControl ? 'text-blue-600' : isPositive ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {valueFormatter(value)}
        </div>

        {/* 变化百分比 */}
        {!isControl && (
          <div
            className={`flex items-center gap-1 text-sm font-medium ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {isPositive ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            {Math.abs(change).toFixed(2)}%
          </div>
        )}
      </div>

      {/* 置信区间 */}
      {!isControl && showCI && (
        <div className="text-xs text-gray-500 mb-2">
          {ciLower.toFixed(2)}% to {ciUpper.toFixed(2)}%
        </div>
      )}

      {/* 预估影响 */}
      {!isControl && estimateKey && estimateLabel && (
        <div className="text-xs text-gray-600 mb-2">
          {estimateLabel}: {valueFormatter(variant[estimateKey] as number)}
        </div>
      )}

      {/* 统计显著性标识 */}
      {!isControl && isSignificant && (
        <div className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
          ✓ Statistically Significant
        </div>
      )}

      {!isControl && !isSignificant && variant.p_value !== null && (
        <div className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
          Not Yet Significant (p={variant.p_value.toFixed(3)})
        </div>
      )}
    </div>
  )
}
