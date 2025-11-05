'use client'

import React, { useState } from 'react'
import type { VariantComparison } from '@/lib/analytics/types'

interface VariantComparisonTableProps {
  variants: VariantComparison[]
  segmentData?: {
    desktop?: VariantComparison[]
    mobile?: VariantComparison[]
    new?: VariantComparison[]
    returning?: VariantComparison[]
    sourceSites?: Array<{
      source: string
      variants: VariantComparison[]
    }>
  }
}

type TabType = 'all' | 'desktop-mobile' | 'new-returning' | 'source-sites'

/**
 * 变体对比表格组件
 * 参考 Intelligem 设计底部的表格，显示所有变体的详细数据对比
 */
export function VariantComparisonTable({ variants, segmentData }: VariantComparisonTableProps) {
  const [activeTab, setActiveTab] = useState<TabType>('all')

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

  const tabs = [
    { id: 'all', label: 'All Visitors' },
    { id: 'desktop-mobile', label: 'Desktop/Mobile' },
    { id: 'new-returning', label: 'New/Returning' },
    { id: 'source-sites', label: 'Source Sites' },
  ] as const

  const renderTable = (data: VariantComparison[], title?: string) => (
    <div className="mb-6">
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      )}
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
            {data.map((variant) => {
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
    </div>
  )

  const renderContent = () => {
    switch (activeTab) {
      case 'all':
        return renderTable(variants)

      case 'desktop-mobile':
        return (
          <>
            {segmentData?.desktop && renderTable(segmentData.desktop, 'Desktop')}
            {segmentData?.mobile && renderTable(segmentData.mobile, 'Mobile')}
          </>
        )

      case 'new-returning':
        return (
          <>
            {segmentData?.new && renderTable(segmentData.new, 'New Visitors')}
            {segmentData?.returning && renderTable(segmentData.returning, 'Returning Visitors')}
          </>
        )

      case 'source-sites':
        return (
          <>
            {segmentData?.sourceSites?.map((sourceGroup) =>
              renderTable(sourceGroup.variants, sourceGroup.source)
            )}
          </>
        )

      default:
        return renderTable(variants)
    }
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  )
}
