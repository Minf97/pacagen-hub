import Link from "next/link"
import { Plus, Play, Pause, CheckCircle, Archive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import type { Experiment } from "@/lib/supabase/types"

// Status badge component
function StatusBadge({ status }: { status: Experiment['status'] }) {
  const styles = {
    draft: "bg-gray-100 text-gray-800",
    running: "bg-green-100 text-green-800",
    paused: "bg-yellow-100 text-yellow-800",
    completed: "bg-blue-100 text-blue-800",
    archived: "bg-gray-100 text-gray-600",
  }

  const icons = {
    draft: "📝",
    running: <Play className="h-3 w-3" />,
    paused: <Pause className="h-3 w-3" />,
    completed: <CheckCircle className="h-3 w-3" />,
    archived: <Archive className="h-3 w-3" />,
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default async function ExperimentsPage() {
  const supabase = await createClient()

  // Fetch all experiments with variant count
  const { data: experiments, error } = await supabase
    .from('experiments')
    .select(`
      *,
      variants:variants!variants_experiment_id_fkey (count)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching experiments:', error)
  }

  // Get summary stats
  const activeCount = experiments?.filter(e => e.status === 'running').length || 0
  const draftCount = experiments?.filter(e => e.status === 'draft').length || 0
  const completedCount = experiments?.filter(e => e.status === 'completed').length || 0

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Experiments</h1>
          <p className="text-muted-foreground">
            Create and manage A/B tests for your storefront
          </p>
        </div>
        <Link href="/experiments/new">
          <Button size="lg">
            <Plus className="h-4 w-4" />
            New Experiment
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Experiments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Drafts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{draftCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{completedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Experiments List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">All Experiments</h2>

        {!experiments || experiments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FlaskConical className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No experiments yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Get started by creating your first A/B test experiment
              </p>
              <Link href="/experiments/new">
                <Button>
                  <Plus className="h-4 w-4" />
                  Create Experiment
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {experiments.map((experiment) => (
              <Link key={experiment.id} href={`/experiments/${experiment.id}`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle>{experiment.name}</CardTitle>
                        {experiment.description && (
                          <CardDescription>{experiment.description}</CardDescription>
                        )}
                      </div>
                      <StatusBadge status={experiment.status} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">Variants:</span>{' '}
                        {(experiment.variants as any)?.[0]?.count || 0}
                      </div>
                      <div>
                        <span className="font-medium">Created:</span>{' '}
                        {new Date(experiment.created_at).toLocaleDateString()}
                      </div>
                      {experiment.started_at && (
                        <div>
                          <span className="font-medium">Started:</span>{' '}
                          {new Date(experiment.started_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FlaskConical(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M10 2v8L4 21h16L14 10V2" />
      <path d="M8.5 2h7" />
      <path d="M7 16h10" />
    </svg>
  )
}
