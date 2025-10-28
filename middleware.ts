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

  const isLoginPage = request.nextUrl.pathname === '/login'
  const isApiLogin = request.nextUrl.pathname === '/api/login'
  const authCookie = request.cookies.get('auth')
  const pathname = request.nextUrl.pathname
  const method = request.method

  // Get client IP for logging
  const clientIp = request.ip || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')

  // Allow A/B test client requests (from headless storefront)
  const isABTestClient = request.headers.get('X-AB-Test-Client') === 'headless-storefront'
  if (isABTestClient) {
    const response = NextResponse.next()
    const duration = Date.now() - startTime
    logRequest(method, pathname, 200, duration, clientIp || undefined)
    return response
  }

  // Allow access to login page and login API
  if (isLoginPage || isApiLogin) {
    const response = NextResponse.next()
    const duration = Date.now() - startTime
    logRequest(method, pathname, 200, duration, clientIp || undefined)
    return response
  }

  // Redirect to login if not authenticated
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
