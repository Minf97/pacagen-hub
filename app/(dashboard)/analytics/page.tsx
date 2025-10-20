'use client'

import { useEffect, useState } from 'react'
import { BarChart3, TrendingUp, Users, DollarSign, Target, Zap, Award } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import type { Experiment, Variant } from '@/lib/supabase/types'

interface ExperimentWithVariants extends Experiment {
  variants: Variant[]
}

interface ExperimentStats {
  experiment_id: string
  experiment_name: string
  status: string
  total_visitors: number
  total_conversions: number
  total_revenue: number
  conversion_rate: number
  started_at: string | null
  winning_variant: string | null
}

export default function AnalyticsPage() {
  const [experiments, setExperiments] = useState<ExperimentWithVariants[]>([])
  const [statsData, setStatsData] = useState<ExperimentStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      // Fetch all experiments
      const expResponse = await fetch('/api/experiments')
      const { experiments } = await expResponse.json()
      setExperiments(experiments || [])

      // Fetch stats for each running/completed experiment
      const statsPromises = experiments
        .filter((exp: ExperimentWithVariants) =>
          exp.status === 'running' || exp.status === 'completed'
        )
        .map(async (exp: ExperimentWithVariants) => {
          try {
            const response = await fetch(`/api/experiments/${exp.id}/stats`)
            const data = await response.json()

            if (data.summary) {
              return {
                experiment_id: exp.id,
                experiment_name: exp.name,
                status: exp.status,
                total_visitors: data.summary.total_visitors,
                total_conversions: data.summary.total_orders,
                total_revenue: data.summary.total_revenue,
                conversion_rate: data.summary.control_conversion_rate,
                started_at: exp.started_at,
                winning_variant: data.summary.winning_variant_id
                  ? data.summary.variants.find((v: any) => v.variant_id === data.summary.winning_variant_id)?.variant_name
                  : null
              }
            }
            return null
          } catch (err) {
            console.error(`Failed to fetch stats for ${exp.name}:`, err)
            return null
          }
        })

      const stats = (await Promise.all(statsPromises)).filter(Boolean) as ExperimentStats[]
      setStatsData(stats)
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  // Calculate global metrics
  const globalMetrics = {
    totalExperiments: experiments.length,
    runningExperiments: experiments.filter(e => e.status === 'running').length,
    completedExperiments: experiments.filter(e => e.status === 'completed').length,
    totalVisitors: statsData.reduce((sum, s) => sum + s.total_visitors, 0),
    totalConversions: statsData.reduce((sum, s) => sum + s.total_conversions, 0),
    totalRevenue: statsData.reduce((sum, s) => sum + s.total_revenue, 0),
    avgConversionRate: statsData.length > 0
      ? statsData.reduce((sum, s) => sum + s.conversion_rate, 0) / statsData.length
      : 0
  }

  // Sort experiments by different metrics
  const topByConversionRate = [...statsData]
    .sort((a, b) => b.conversion_rate - a.conversion_rate)
    .slice(0, 5)

  const topByRevenue = [...statsData]
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, 5)

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    running: 'bg-green-100 text-green-800',
    paused: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-blue-100 text-blue-800',
    archived: 'bg-gray-100 text-gray-600',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
        <p className="text-muted-foreground">
          Global performance metrics across all experiments
        </p>
      </div>

      {/* Global Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Experiments
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{globalMetrics.totalExperiments}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {globalMetrics.runningExperiments} running · {globalMetrics.completedExperiments} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Visitors
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {globalMetrics.totalVisitors.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all experiments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${globalMetrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {globalMetrics.totalConversions.toLocaleString()} conversions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Conversion Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {globalMetrics.avgConversionRate.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {statsData.length} active experiments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top by Conversion Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-500" />
              Top Performing Experiments
            </CardTitle>
            <CardDescription>Ranked by conversion rate</CardDescription>
          </CardHeader>
          <CardContent>
            {topByConversionRate.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No active experiments yet
              </div>
            ) : (
              <div className="space-y-3">
                {topByConversionRate.map((stat, index) => (
                  <Link
                    key={stat.experiment_id}
                    href={`/experiments/${stat.experiment_id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-6 h-6 rounded-full ${
                          index === 0 ? 'bg-yellow-100 text-yellow-700' :
                          index === 1 ? 'bg-gray-100 text-gray-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-muted text-muted-foreground'
                        } text-xs font-bold`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{stat.experiment_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {stat.total_visitors.toLocaleString()} visitors
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-green-600">
                          {stat.conversion_rate.toFixed(2)}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          CVR
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top by Revenue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              Highest Revenue Generators
            </CardTitle>
            <CardDescription>Ranked by total revenue</CardDescription>
          </CardHeader>
          <CardContent>
            {topByRevenue.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No revenue data yet
              </div>
            ) : (
              <div className="space-y-3">
                {topByRevenue.map((stat, index) => (
                  <Link
                    key={stat.experiment_id}
                    href={`/experiments/${stat.experiment_id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-6 h-6 rounded-full ${
                          index === 0 ? 'bg-green-100 text-green-700' :
                          index === 1 ? 'bg-blue-100 text-blue-700' :
                          index === 2 ? 'bg-purple-100 text-purple-700' :
                          'bg-muted text-muted-foreground'
                        } text-xs font-bold`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{stat.experiment_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {stat.total_conversions.toLocaleString()} orders
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-green-600">
                          ${stat.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Revenue
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Experiments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            Recent Experiments
          </CardTitle>
          <CardDescription>Latest experiment activity</CardDescription>
        </CardHeader>
        <CardContent>
          {experiments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No experiments created yet
            </div>
          ) : (
            <div className="space-y-3">
              {experiments.slice(0, 10).map((exp) => {
                const stat = statsData.find(s => s.experiment_id === exp.id)
                return (
                  <Link
                    key={exp.id}
                    href={`/experiments/${exp.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-medium">{exp.name}</div>
                          <Badge className={statusColors[exp.status]}>
                            {exp.status}
                          </Badge>
                        </div>
                        {exp.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {exp.description}
                          </div>
                        )}
                      </div>
                      {stat && (
                        <div className="text-right ml-4">
                          <div className="text-sm font-semibold">
                            {stat.conversion_rate.toFixed(2)}% CVR
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ${stat.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} revenue
                          </div>
                        </div>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
