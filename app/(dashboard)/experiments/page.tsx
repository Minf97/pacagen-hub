import Link from 'next/link';
import { Plus, Play, Pause, CheckCircle, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getAllExperiments } from '@/lib/db/queries';
import type { Experiment } from '@/lib/db/schema';

// Force dynamic rendering - experiments data changes frequently
export const dynamic = 'force-dynamic';

// Status badge component
function StatusBadge({ status }: { status: Experiment['status'] }) {
  const styles = {
    draft: 'bg-gradient-to-r from-gray-100 to-gray-50 text-gray-700 border border-gray-200',
    running: 'bg-gradient-to-r from-emerald-100 to-emerald-50 text-emerald-700 border border-emerald-200',
    paused: 'bg-gradient-to-r from-amber-100 to-amber-50 text-amber-700 border border-amber-200',
    completed: 'bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 border border-blue-200',
    archived: 'bg-gradient-to-r from-slate-100 to-slate-50 text-slate-600 border border-slate-200',
  };

  const icons = {
    draft: '📝',
    running: <Play className="h-3 w-3" />,
    paused: <Pause className="h-3 w-3" />,
    completed: <CheckCircle className="h-3 w-3" />,
    archived: <Archive className="h-3 w-3" />,
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium shadow-sm ${styles[status]}`}
    >
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default async function ExperimentsPage() {
  // Fetch all experiments with variants
  const experiments = await getAllExperiments();

  // Get summary stats
  const activeCount = experiments?.filter((e) => e.status === 'running').length || 0;
  const draftCount = experiments?.filter((e) => e.status === 'draft').length || 0;
  const completedCount = experiments?.filter((e) => e.status === 'completed').length || 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Experiments
          </h1>
          <p className="text-muted-foreground mt-2">Create and manage A/B tests for your storefront</p>
        </div>
        <Link href="/experiments/new">
          <Button size="lg" className="shadow-lg">
            <Plus className="h-5 w-5" />
            New Experiment
          </Button>
        </Link>
      </div>

      {/* Summary Cards with Gradient */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="relative overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Experiments</CardTitle>
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg">
                <Play className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold bg-gradient-to-br from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
              {activeCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Currently running</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Drafts</CardTitle>
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg">
                <span className="text-xl">📝</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold bg-gradient-to-br from-amber-600 to-amber-500 bg-clip-text text-transparent">
              {draftCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">In preparation</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold bg-gradient-to-br from-blue-600 to-blue-500 bg-clip-text text-transparent">
              {completedCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total finished</p>
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
          <div className="grid gap-5">
            {experiments.map((experiment, index) => (
              <Link key={experiment.id} href={`/experiments/${experiment.id}`}>
                <Card className="group cursor-pointer" style={{ animationDelay: `${index * 50}ms` }}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg group-hover:text-primary transition-colors">
                            {experiment.name}
                          </CardTitle>
                          <StatusBadge status={experiment.status} />
                        </div>
                        {experiment.description && (
                          <CardDescription className="text-sm leading-relaxed">{experiment.description}</CardDescription>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="text-foreground/70">📊</span>
                        <span className="font-medium text-foreground">{experiment.variants?.length || 0}</span>
                        <span>variants</span>
                      </div>
                      <div className="h-4 w-px bg-border" />
                      <div className="flex items-center gap-1.5">
                        <span className="text-foreground/70">📅</span>
                        <span className="font-medium text-foreground">
                          {new Date(experiment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {experiment.startedAt && (
                        <>
                          <div className="h-4 w-px bg-border" />
                          <div className="flex items-center gap-1.5">
                            <Play className="h-3.5 w-3.5 text-emerald-500" />
                            <span>{new Date(experiment.startedAt).toLocaleDateString()}</span>
                          </div>
                        </>
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
  );
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
  );
}
