import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Format timestamp for logging
 */
function formatTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').split('.')[0]
}

/**
 * Log request to stdout (captured by Docker logs)
 */
function logRequest(
  method: string,
  pathname: string,
  status: number,
  duration: number,
  clientIp?: string
) {
  // Skip logging for healthcheck to reduce noise
  if (pathname === '/api/health') return

  const timestamp = formatTimestamp()
  const ipInfo = clientIp ? ` from ${clientIp}` : ''
  console.log(`[${timestamp}] ${method} ${pathname} ${status} ${duration}ms${ipInfo}`)
}

export function middleware(request: NextRequest) {
  // Start timing
  const startTime = Date.now()

  const pathname = request.nextUrl.pathname
  const method = request.method

  // Get client IP for logging
  const clientIp = request.ip || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')

  // Skip auth for all API routes (they should handle their own auth if needed)
  const isApiRoute = pathname.startsWith('/api/')
  if (isApiRoute) {
    const response = NextResponse.next()
    const duration = Date.now() - startTime
    logRequest(method, pathname, 200, duration, clientIp || undefined)
    return response
  }

  // Skip auth for login page
  if (pathname === '/login') {
    const response = NextResponse.next()
    const duration = Date.now() - startTime
    logRequest(method, pathname, 200, duration, clientIp || undefined)
    return response
  }

  // For dashboard pages, check auth cookie
  const authCookie = request.cookies.get('auth')
  if (!authCookie) {
    const duration = Date.now() - startTime
    logRequest(method, pathname, 302, duration, clientIp || undefined)
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const response = NextResponse.next()
  const duration = Date.now() - startTime
  logRequest(method, pathname, 200, duration, clientIp || undefined)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
