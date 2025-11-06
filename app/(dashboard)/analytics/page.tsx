'use client'

import { useEffect, useState } from 'react'
import { Activity, TrendingUp, Globe, Smartphone, Zap, Award } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PerformanceMetricCard } from '@/components/performance/PerformanceMetricCard'
import { SlowPagesTable } from '@/components/performance/SlowPagesTable'
import type { PerformanceSummary, DevicePerformanceBreakdown } from '@/lib/performance/types'
import { WEB_VITALS_THRESHOLDS } from '@/lib/performance/types'

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<PerformanceSummary | null>(null)
  const [deviceBreakdown, setDeviceBreakdown] = useState<DevicePerformanceBreakdown[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPerformanceData()
  }, [])

  const fetchPerformanceData = async () => {
    try {
      // Fetch last 30 days of performance data
      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]

      const response = await fetch(
        `/api/performance/stats?startDate=${startDate}&endDate=${endDate}`
      )
      const data = await response.json()

      setSummary(data.summary)
      setDeviceBreakdown(data.deviceBreakdown || [])
    } catch (err) {
      console.error('Failed to fetch performance data:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading performance data...</div>
      </div>
    )
  }

  if (!summary || summary.totalPages === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Page Performance Analytics</h1>
          <p className="text-muted-foreground">
            Real-time performance monitoring for your Hydrogen storefront
          </p>
        </div>

        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Performance Data Yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start collecting performance metrics by integrating the tracking script in your
                Hydrogen storefront.
              </p>
              <div className="bg-muted p-4 rounded-lg text-left max-w-2xl mx-auto">
                <code className="text-xs">
                  {`// In your Hydrogen root.tsx
import { usePerformanceMonitoring } from '@/lib/performance'

export default function App() {
  usePerformanceMonitoring('https://your-hub.com/api/performance/track')
  // ...
}`}
                </code>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Page Performance Analytics</h1>
        <p className="text-muted-foreground">
          Core Web Vitals and performance metrics for your Hydrogen storefront
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Last 30 days · {summary.totalSamples?.toLocaleString()} samples across{' '}
          {summary.totalPages} pages
        </p>
      </div>

      {/* Global Performance Score */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overall Score
            </CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.avgOverallScore}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.avgOverallScore >= 75
                ? '✓ Excellent performance'
                : summary.avgOverallScore >= 50
                ? '⚠ Needs improvement'
                : '✗ Poor performance'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Core Web Vitals
            </CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.pagesPassingCoreWebVitals.toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pages passing all vitals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pages
            </CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalPages}</div>
            <p className="text-xs text-muted-foreground mt-1">Being monitored</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Samples
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.totalSamples?.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Core Web Vitals Metrics */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Core Web Vitals</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <PerformanceMetricCard
            title="Largest Contentful Paint (LCP)"
            metric={summary.overallLcp}
            metricType="ms"
            threshold={WEB_VITALS_THRESHOLDS.LCP}
          />
          <PerformanceMetricCard
            title="Cumulative Layout Shift (CLS)"
            metric={summary.overallCls}
            metricType="score"
            threshold={WEB_VITALS_THRESHOLDS.CLS}
          />
        </div>
      </div>

      {/* Additional Performance Metrics */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Additional Metrics</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <PerformanceMetricCard
            title="First Contentful Paint (FCP)"
            metric={summary.overallFcp}
            metricType="ms"
            threshold={WEB_VITALS_THRESHOLDS.FCP}
          />
          <PerformanceMetricCard
            title="Time to First Byte (TTFB)"
            metric={summary.overallTtfb}
            metricType="ms"
            threshold={WEB_VITALS_THRESHOLDS.TTFB}
          />
        </div>
      </div>

      {/* Device Performance Breakdown */}
      {deviceBreakdown.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Performance by Device</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {deviceBreakdown.map((device) => (
              <Card key={device.deviceType}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    {device.deviceType.charAt(0).toUpperCase() + device.deviceType.slice(1)}
                  </CardTitle>
                  <CardDescription>
                    {device.sampleCount.toLocaleString()} samples
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Overall Score</span>
                      <span className="font-bold text-lg">{device.overallScore}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">LCP (p75)</span>
                      <span>{(device.lcp.p75 / 1000).toFixed(2)}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CLS (p75)</span>
                      <span>{device.cls.p75.toFixed(3)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Top & Slow Pages */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-green-500" />
              Top Performing Pages
            </CardTitle>
            <CardDescription>Ranked by overall performance score</CardDescription>
          </CardHeader>
          <CardContent>
            <SlowPagesTable pages={summary.topPages} title="" type="top" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-red-500" />
              Pages Needing Attention
            </CardTitle>
            <CardDescription>Lowest performing pages</CardDescription>
          </CardHeader>
          <CardContent>
            <SlowPagesTable pages={summary.slowPages} title="" type="slow" />
          </CardContent>
        </Card>
      </div>

      {/* Integration Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Status</CardTitle>
          <CardDescription>Performance monitoring is active and collecting data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span>
              Tracking {summary.totalPages} pages with {summary.totalSamples?.toLocaleString()}{' '}
              samples in the last 30 days
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Data is collected from your Hydrogen storefront using the Web Vitals API and Navigation
            Timing API. Metrics are automatically aggregated daily.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
