'use client'

import { Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PercentileMetric } from '@/lib/performance/types'
import { formatMs, getScoreColor, getScoreBgColor } from '@/lib/performance/types'

interface PerformanceMetricCardProps {
  title: string
  metric: PercentileMetric
  metricType: 'ms' | 'score'
  threshold?: {
    good: number
    needsImprovement: number
  }
}

export function PerformanceMetricCard({
  title,
  metric,
  metricType,
  threshold,
}: PerformanceMetricCardProps) {
  const scoreColorClass = getScoreColor(metric.score)
  const scoreBgClass = getScoreBgColor(metric.score)

  const formatValue = (value: number) => {
    if (metricType === 'ms') {
      return formatMs(value)
    } else {
      return value.toFixed(3)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold">
            {formatValue(metric.p75)}
          </div>
          <div className={`text-xs font-medium px-2 py-1 rounded ${scoreBgClass} ${scoreColorClass}`}>
            {metric.score === 'good' ? 'Good' : metric.score === 'needs-improvement' ? 'Needs Work' : 'Poor'}
          </div>
        </div>

        {/* Percentile breakdown */}
        <div className="mt-4 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">p50 (median)</span>
            <span className="font-medium">{formatValue(metric.p50)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">p75</span>
            <span className="font-medium">{formatValue(metric.p75)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">p95 (worst)</span>
            <span className="font-medium text-red-600">{formatValue(metric.p95)}</span>
          </div>
        </div>

        {/* Threshold reference */}
        {threshold && (
          <div className="mt-4 pt-3 border-t text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Good:</span>
              <span>{metricType === 'ms' ? formatMs(threshold.good) : threshold.good}</span>
            </div>
            <div className="flex justify-between">
              <span>Poor:</span>
              <span>{'>'} {metricType === 'ms' ? formatMs(threshold.needsImprovement) : threshold.needsImprovement}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
