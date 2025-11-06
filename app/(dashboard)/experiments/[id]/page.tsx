'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Play, Pause, Trash2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { Experiment, Variant } from '@/lib/db/schema'
import type { ExperimentSummary, TimeSeriesDataPoint, VariantComparison } from '@/lib/analytics/types'
import { MetricCard } from '@/components/analytics/MetricCard'
import { MetricComparisonChart } from '@/components/analytics/MetricComparisonChart'
import { VariantComparisonTable } from '@/components/analytics/VariantComparisonTable'
import { TrendChart } from '@/components/analytics/TrendChart'
import {
  getConversionRateExplanation,
  getRevenuePerVisitorExplanation,
  getProfitPerVisitorExplanation,
  getAvgOrderValueExplanation
} from '@/components/analytics/CalculationExplanation'
import { EditableWeight } from '@/components/experiments/EditableWeight'

interface ExperimentWithVariants extends Experiment {
  variants: Variant[]
}

interface StatsData {
  summary: ExperimentSummary
  time_series: TimeSeriesDataPoint[]
  segmentData?: {
    desktop?: VariantComparison[]
    mobile?: VariantComparison[]
    new?: VariantComparison[]
    returning?: VariantComparison[]
  }
}

export default function ExperimentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [experiment, setExperiment] = useState<ExperimentWithVariants | null>(null)
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [experimentId, setExperimentId] = useState<string | null>(null)
  const [weightWarning, setWeightWarning] = useState<string | null>(null)

  // Unwrap params
  useEffect(() => {
    params.then((p) => setExperimentId(p.id))
  }, [params])

  // Fetch experiment data
  useEffect(() => {
    if (!experimentId) return

    const fetchExperiment = async () => {
      try {
        const response = await fetch(`/api/experiments/${experimentId}`)
        if (!response.ok) throw new Error('Failed to fetch experiment')

        const { experiment } = await response.json()
        setExperiment(experiment)

        // Fetch stats if experiment is running or completed
        if (experiment.status === 'running' || experiment.status === 'completed') {
          fetchStats()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    const fetchStats = async () => {
      setStatsLoading(true)
      try {
        const response = await fetch(`/api/experiments/${experimentId}/stats`)
        if (!response.ok) throw new Error('Failed to fetch stats')

        const data = await response.json()
        setStats(data)
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        setStatsLoading(false)
      }
    }

    fetchExperiment()
  }, [experimentId])

  // Update experiment status
  const updateStatus = async (newStatus: Experiment['status']) => {
    if (!experiment) return

    setActionLoading(true)
    try {
      const response = await fetch(`/api/experiments/${experiment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) throw new Error('Failed to update status')

      const { experiment: updated } = await response.json()
      setExperiment(updated)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setActionLoading(false)
    }
  }

  // Delete experiment
  const deleteExperiment = async () => {
    if (!experiment) return
    if (!confirm('Are you sure you want to delete this experiment? This action cannot be undone.')) {
      return
    }

    setActionLoading(true)
    try {
      const response = await fetch(`/api/experiments/${experiment.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const { error } = await response.json()
        throw new Error(error || 'Failed to delete experiment')
      }

      router.push('/experiments')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete experiment')
      setActionLoading(false)
    }
  }

  // Update variant weight
  const updateVariantWeight = async (variantId: string, newWeight: number) => {
    setWeightWarning(null)

    try {
      const response = await fetch(`/api/variants/${variantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight: newWeight }),
      })

      if (!response.ok) {
        const { error } = await response.json()
        throw new Error(error || 'Failed to update weight')
      }

      const { variant, warning } = await response.json()

      // Update local state
      if (experiment) {
        setExperiment({
          ...experiment,
          variants: experiment.variants.map((v) =>
            v.id === variantId ? { ...v, weight: variant.weight } : v
          ),
        })
      }

      // Show warning if total weight is not 100%
      if (warning) {
        setWeightWarning(warning)
      }
    } catch (err) {
      throw err // Let EditableWeight component handle the error
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading experiment...</div>
      </div>
    )
  }

  if (error || !experiment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-destructive">{error || 'Experiment not found'}</div>
        <Link href="/experiments">
          <Button variant="outline">Back to Experiments</Button>
        </Link>
      </div>
    )
  }

  const statusColors: Record<Experiment['status'], string> = {
    draft: 'bg-gray-100 text-gray-800',
    running: 'bg-green-100 text-green-800',
    paused: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-blue-100 text-blue-800',
    archived: 'bg-gray-100 text-gray-600',
  }

  console.log(stats, "stats")

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link href="/experiments">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight">{experiment.name}</h1>
              <Badge className={statusColors[experiment.status]}>
                {experiment.status.charAt(0).toUpperCase() + experiment.status.slice(1)}
              </Badge>
            </div>
            {experiment.description && (
              <p className="text-muted-foreground">{experiment.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Start/Resume button - available for all non-running states */}
          {experiment.status !== 'running' && (
            <Button
              onClick={() => updateStatus('running')}
              disabled={actionLoading}
            >
              <Play className="h-4 w-4" />
              {experiment.status === 'draft' ? 'Start Experiment' : 'Resume Experiment'}
            </Button>
          )}

          {/* Pause button - only when running */}
          {experiment.status === 'running' && (
            <Button
              onClick={() => updateStatus('paused')}
              disabled={actionLoading}
              variant="outline"
            >
              <Pause className="h-4 w-4" />
              Pause
            </Button>
          )}

          {/* Complete button - only when paused or running */}
          {(experiment.status === 'paused' || experiment.status === 'running') && (
            <Button
              onClick={() => updateStatus('completed')}
              disabled={actionLoading}
              variant="outline"
            >
              <CheckCircle className="h-4 w-4" />
              Complete
            </Button>
          )}

          {/* Delete button - disabled when running */}
          <Button
            variant="outline"
            size="icon"
            onClick={deleteExperiment}
            disabled={actionLoading || experiment.status === 'running'}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Experiment Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {experiment.hypothesis && (
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Hypothesis</div>
                <div className="text-sm">{experiment.hypothesis}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Created</div>
                <div className="text-sm">{new Date(experiment.createdAt).toLocaleString()}</div>
              </div>

              {experiment.startedAt && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Started</div>
                  <div className="text-sm">{new Date(experiment.startedAt).toLocaleString()}</div>
                </div>
              )}

              {experiment.endedAt && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Ended</div>
                  <div className="text-sm">{new Date(experiment.endedAt).toLocaleString()}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Variants ({experiment.variants.length})</CardTitle>
            <CardDescription>
              Traffic allocation must total 100%
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {weightWarning && (
              <Alert variant="destructive">
                <AlertDescription>{weightWarning}</AlertDescription>
              </Alert>
            )}
            {experiment.variants.map((variant) => (
              <div key={variant.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-medium">{variant.displayName}</div>
                    {variant.isControl && (
                      <div className="text-xs text-muted-foreground">⭐ Control</div>
                    )}
                  </div>
                </div>
                <EditableWeight
                  variantId={variant.id}
                  initialWeight={variant.weight}
                  onUpdate={updateVariantWeight}
                  disabled={experiment.status === 'running'}
                />
              </div>
            ))}
            {experiment.status === 'running' && (
              <p className="text-xs text-muted-foreground mt-2">
                💡 Weight editing is disabled while the experiment is running
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Statistics */}
      {(experiment.status === 'running' || experiment.status === 'completed') && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
              <CardDescription>
                Real-time experiment performance
                {stats?.summary.duration_days && ` · Running for ${stats.summary.duration_days} days`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                  Loading statistics...
                </div>
              ) : !stats || stats.summary.variants.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  📊 No statistics data yet. Start collecting data by sending traffic to your experiment.
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Metric Cards Grid */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Key Metrics Overview</h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      {stats.summary.variants.map((variant) => (
                        <div key={variant.variant_id} className="space-y-4">
                          <div className="text-sm font-medium text-gray-700 mb-2">
                            {variant.variant_name}
                            {variant.is_control && ' (Control)'}
                          </div>

                          <MetricCard
                            variant={variant}
                            metricKey="conversion_rate"
                            title="Conversion Rate"
                            valueFormatter={(v) => `${v.toFixed(2)}%`}
                            estimateKey="estimated_monthly_orders"
                            estimateLabel="EST. MONTHLY ORDERS"
                            explanation={getConversionRateExplanation(variant)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Comparison Charts */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Variant Comparison</h3>
                    <div className="grid gap-6 md:grid-cols-2">
                      <MetricComparisonChart
                        variants={stats.summary.variants}
                        metricKey="conversion_rate"
                        title="Conversion Rate"
                        valueFormatter={(v) => `${v.toFixed(2)}%`}
                        explanation={getConversionRateExplanation(
                          stats.summary.variants.find(v => v.is_control) || stats.summary.variants[0]
                        )}
                      />
                      <MetricComparisonChart
                        variants={stats.summary.variants}
                        metricKey="revenue_per_visitor"
                        title="Revenue per Visitor"
                        valueFormatter={(v) => `$${v.toFixed(2)}`}
                        explanation={getRevenuePerVisitorExplanation(
                          stats.summary.variants.find(v => v.is_control) || stats.summary.variants[0]
                        )}
                      />
                      <MetricComparisonChart
                        variants={stats.summary.variants}
                        metricKey="profit_per_visitor"
                        title="Profit per Visitor"
                        valueFormatter={(v) => `$${v.toFixed(2)}`}
                        explanation={getProfitPerVisitorExplanation(
                          stats.summary.variants.find(v => v.is_control) || stats.summary.variants[0]
                        )}
                      />
                      <MetricComparisonChart
                        variants={stats.summary.variants}
                        metricKey="avg_order_value"
                        title="Average Order Value"
                        valueFormatter={(v) => `$${v.toFixed(2)}`}
                        explanation={getAvgOrderValueExplanation(
                          stats.summary.variants.find(v => v.is_control) || stats.summary.variants[0]
                        )}
                      />
                    </div>
                  </div>

                  {/* Trend Charts */}
                  {stats.time_series.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Trends Over Time</h3>
                      <div className="space-y-6">
                        <TrendChart
                          timeSeriesData={stats.time_series}
                          metricKey="conversion_rate"
                          title="Conversion Rate"
                          valueFormatter={(v) => `${v.toFixed(2)}%`}
                        />
                        <TrendChart
                          timeSeriesData={stats.time_series}
                          metricKey="revenue"
                          title="Revenue"
                          valueFormatter={(v) => `$${v.toFixed(2)}`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Detailed Comparison Table */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Detailed Breakdown</h3>
                    <VariantComparisonTable
                      variants={stats.summary.variants}
                      segmentData={stats.segmentData}
                    />
                  </div>

                  {/* Statistical Significance Note */}
                  {stats.summary.is_statistically_significant && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        <div>
                          <div className="font-medium text-green-900">
                            Statistically Significant Results
                          </div>
                          <div className="text-sm text-green-700 mt-1">
                            The winning variant shows a statistically significant improvement of{' '}
                            {stats.summary.winning_variant_improvement?.toFixed(2)}% over the control
                            group (p {'<'} 0.05). You can confidently deploy this variant.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
