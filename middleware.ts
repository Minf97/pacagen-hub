import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const isLoginPage = request.nextUrl.pathname === '/login'
  const isApiLogin = request.nextUrl.pathname === '/api/login'
  const authCookie = request.cookies.get('auth')

  // Allow access to login page and login API
  if (isLoginPage || isApiLogin) {
    return NextResponse.next()
  }

  // Redirect to login if not authenticated
  if (!authCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
