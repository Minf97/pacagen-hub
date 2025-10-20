import Link from "next/link"
import { FlaskConical, BarChart3, Settings, BookOpen } from "lucide-react"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header with glass effect */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-background/80 border-b border-border/50 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/experiments" className="flex items-center gap-2 group">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md group-hover:shadow-lg transition-all duration-200">
                <FlaskConical className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                PacagenHub
              </h1>
            </Link>

            {/* Navigation */}
            <nav className="flex items-center gap-2">
              <Link
                href="/experiments"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200"
              >
                <FlaskConical className="h-4 w-4" />
                <span className="hidden sm:inline">Experiments</span>
              </Link>
              <Link
                href="/analytics"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Analytics</span>
              </Link>
              <Link
                href="/settings"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
