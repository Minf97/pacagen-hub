import { Settings as SettingsIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SettingsPage() {
  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your A/B testing framework
        </p>
      </div>

      {/* Coming Soon Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>System Settings</CardTitle>
          <CardDescription>
            Manage authentication, integrations, and preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <SettingsIcon className="h-16 w-16 text-muted-foreground" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Settings Panel Coming Soon</h3>
              <p className="text-muted-foreground max-w-md">
                Planned configuration options:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 text-left max-w-md mx-auto">
                <li>• Not configured yet</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Settings Placeholder */}
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Supabase Connection</CardTitle>
            <CardDescription>Database connection status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500"></div>
              <span className="text-sm">Connected</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Environment</CardTitle>
            <CardDescription>Current deployment environment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
