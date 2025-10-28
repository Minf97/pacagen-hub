/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]

    console.log('\n========================================')
    console.log(`[${timestamp}] 🎉 PacagenHub Application Started`)
    console.log('========================================')
    console.log(`Environment: ${process.env.NODE_ENV}`)
    console.log(`Node Version: ${process.version}`)
    console.log(`Port: ${process.env.PORT || 3000}`)

    // Database connection info (without credentials)
    if (process.env.DATABASE_URL) {
      try {
        const dbUrl = new URL(process.env.DATABASE_URL)
        console.log(`Database: ${dbUrl.hostname}:${dbUrl.port}${dbUrl.pathname}`)
      } catch {
        console.log('Database: Configured')
      }
    }

    console.log('========================================\n')

    // Optional: Register global error handlers
    process.on('uncaughtException', (error) => {
      console.error('[Uncaught Exception]', error)
    })

    process.on('unhandledRejection', (reason, promise) => {
      console.error('[Unhandled Rejection]', reason)
    })
  }
}
