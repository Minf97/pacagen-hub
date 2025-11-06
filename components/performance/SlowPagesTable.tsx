'use client'

import Link from 'next/link'
import type { PagePerformanceRanking } from '@/lib/performance/types'
import { getScoreColor } from '@/lib/performance/types'

interface SlowPagesTableProps {
  pages: PagePerformanceRanking[]
  title: string
  type: 'slow' | 'top'
}

export function SlowPagesTable({ pages, title, type }: SlowPagesTableProps) {
  if (pages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No data available
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="space-y-2">
        {pages.map((page, index) => {
          const scoreClass = page.overallScore >= 75
            ? 'text-green-600'
            : page.overallScore >= 50
            ? 'text-yellow-600'
            : 'text-red-600'

          return (
            <div
              key={page.pagePath}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1">
                <div
                  className={`flex items-center justify-center w-6 h-6 rounded-full ${
                    index === 0 && type === 'top'
                      ? 'bg-yellow-100 text-yellow-700'
                      : index === 1 && type === 'top'
                      ? 'bg-gray-100 text-gray-700'
                      : index === 2 && type === 'top'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-muted text-muted-foreground'
                  } text-xs font-bold`}
                >
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {page.pageTitle || page.pagePath}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {page.pagePath}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {page.sampleCount.toLocaleString()} samples
                  </div>
                </div>
              </div>

              <div className="text-right ml-4">
                <div className={`text-2xl font-bold ${scoreClass}`}>
                  {page.overallScore}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Score
                </div>
                <div className="flex gap-2 mt-2 text-xs">
                  <span className="text-muted-foreground">
                    LCP: {(page.lcpP75 / 1000).toFixed(2)}s
                  </span>
                  <span className="text-muted-foreground">
                    CLS: {page.clsP75.toFixed(3)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
