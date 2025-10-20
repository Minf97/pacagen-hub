'use client'

import React from 'react'
import type { VariantComparison } from '@/lib/analytics/types'

interface VariantComparisonTableProps {
  variants: VariantComparison[]
}

/**
 * 变体对比表格组件
 * 参考 Intelligem 设计底部的表格，显示所有变体的详细数据对比
 */
export function VariantComparisonTable({ variants }: VariantComparisonTableProps) {
  const formatNumber = (num: number) => num.toLocaleString()
  const formatCurrency = (num: number) => `$${num.toFixed(2)}`
  const formatPercent = (num: number) => `${num.toFixed(2)}%`
  const formatChange = (num: number) => {
    if (num === 0) return '-'
    const sign = num > 0 ? '↑' : '↓'
    const color = num > 0 ? 'text-green-600' : 'text-red-600'
    return (
      <span className={`inline-flex items-center gap-1 ${color} font-medium`}>
        {sign} {Math.abs(num).toFixed(0)}%
      </span>
    )
  }

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Group
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Visitors
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Orders
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Net Revenue
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Conversion Rate
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Revenue per Visitor
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              ⭐ Profit per Visitor
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Average Order Value
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {variants.map((variant) => {
            const isControl = variant.is_control
            const rowBg = isControl ? 'bg-blue-50' : ''

            return (
              <tr key={variant.variant_id} className={rowBg}>
                {/* 变体名称 */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {variant.variant_name}
                    </span>
                    {isControl && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        Control
                      </span>
                    )}
                  </div>
                </td>

                {/* 访客数 */}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {formatNumber(variant.visitors)}
                </td>

                {/* 订单数 */}
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm text-gray-900">{formatNumber(variant.orders)}</div>
                  {!isControl && (
                    <div className="text-xs">{formatChange(variant.conversion_rate_change)}</div>
                  )}
                </td>

                {/* 收入 */}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {formatCurrency(variant.revenue)}
                </td>

                {/* 转化率 */}
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {formatPercent(variant.conversion_rate)}
                  </div>
                  {!isControl && (
                    <div className="text-xs">{formatChange(variant.conversion_rate_change)}</div>
                  )}
                </td>

                {/* 每访客收入 */}
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm text-gray-900">
                    {formatCurrency(variant.revenue_per_visitor)}
                  </div>
                  {!isControl && (
                    <div className="text-xs">
                      {formatChange(variant.revenue_per_visitor_change)}
                    </div>
                  )}
                </td>

                {/* 每访客利润 */}
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {formatCurrency(variant.profit_per_visitor)}
                  </div>
                  {!isControl && (
                    <div className="text-xs">
                      {formatChange(variant.profit_per_visitor_change)}
                    </div>
                  )}
                </td>

                {/* 平均订单价值 */}
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm text-gray-900">
                    {formatCurrency(variant.avg_order_value)}
                  </div>
                  {!isControl && (
                    <div className="text-xs">{formatChange(variant.avg_order_value_change)}</div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
