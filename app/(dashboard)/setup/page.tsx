import Link from 'next/link'
import { CheckCircle, Circle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SetupGuidePage() {
  const steps = [
    {
      title: 'Create Supabase Project',
      description: 'Sign up and create a new project at supabase.com',
      completed: false,
      action: {
        label: 'Go to Supabase',
        url: 'https://supabase.com',
      },
    },
    {
      title: 'Run Database Migration',
      description: 'Copy and run the SQL from supabase/migrations/001_initial_schema.sql',
      completed: false,
      code: 'supabase/migrations/001_initial_schema.sql',
    },
    {
      title: 'Configure Environment Variables',
      description: 'Add your Supabase credentials to .env.local',
      completed: false,
      code: `NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key`,
    },
    {
      title: 'Start Development Server',
      description: 'Run npm run dev and visit http://localhost:3000',
      completed: false,
      code: 'npm run dev',
    },
    {
      title: 'Create Your First Experiment',
      description: 'Test the system by creating a sample A/B test',
      completed: false,
      action: {
        label: 'Create Experiment',
        url: '/experiments/new',
      },
    },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Setup Guide</h1>
        <p className="text-muted-foreground">
          Get your A/B testing framework up and running in 5 steps
        </p>
      </div>

      {/* Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Progress</CardTitle>
          <CardDescription>Follow these steps to complete your setup</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {steps.map((step, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex-shrink-0 mt-1">
                  {step.completed ? (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <h3 className="font-semibold">
                      {index + 1}. {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>

                  {step.code && (
                    <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                      {step.code}
                    </pre>
                  )}

                  {step.action && (
                    <div>
                      {step.action.url.startsWith('http') ? (
                        <a
                          href={step.action.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="sm">
                            {step.action.label}
                            <ExternalLink className="h-3 w-3 ml-2" />
                          </Button>
                        </a>
                      ) : (
                        <Link href={step.action.url}>
                          <Button variant="outline" size="sm">
                            {step.action.label}
                          </Button>
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Resources */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Resources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <a
            href="https://github.com/your-repo"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            GitHub Repository
          </a>
          <a
            href="https://supabase.com/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Supabase Documentation
          </a>
          <a
            href="https://linear.app/testing-minf/issue/TES-90"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Linear Issue TES-90 (Full Specification)
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
