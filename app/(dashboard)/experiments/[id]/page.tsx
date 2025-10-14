'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Play, Pause, Edit, Trash2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Experiment, Variant } from '@/lib/supabase/types'

interface ExperimentWithVariants extends Experiment {
  variants: Variant[]
}

export default function ExperimentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [experiment, setExperiment] = useState<ExperimentWithVariants | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [experimentId, setExperimentId] = useState<string | null>(null)

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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
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
          {experiment.status === 'draft' && (
            <Button
              onClick={() => updateStatus('running')}
              disabled={actionLoading}
            >
              <Play className="h-4 w-4" />
              Start Experiment
            </Button>
          )}

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

          {experiment.status === 'paused' && (
            <>
              <Button
                onClick={() => updateStatus('running')}
                disabled={actionLoading}
              >
                <Play className="h-4 w-4" />
                Resume
              </Button>
              <Button
                onClick={() => updateStatus('completed')}
                disabled={actionLoading}
                variant="outline"
              >
                <CheckCircle className="h-4 w-4" />
                Complete
              </Button>
            </>
          )}

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
                <div className="text-sm">{new Date(experiment.created_at).toLocaleString()}</div>
              </div>

              {experiment.started_at && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Started</div>
                  <div className="text-sm">{new Date(experiment.started_at).toLocaleString()}</div>
                </div>
              )}

              {experiment.ended_at && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Ended</div>
                  <div className="text-sm">{new Date(experiment.ended_at).toLocaleString()}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Variants ({experiment.variants.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {experiment.variants.map((variant) => (
              <div key={variant.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-medium">{variant.display_name}</div>
                    {variant.is_control && (
                      <div className="text-xs text-muted-foreground">⭐ Control</div>
                    )}
                  </div>
                </div>
                <div className="text-sm font-medium">{variant.weight}%</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Statistics (placeholder) */}
      {experiment.status === 'running' && (
        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
            <CardDescription>Real-time experiment performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              📊 Statistics dashboard coming soon
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
