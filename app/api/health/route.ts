/**
 * Health Check API
 * Used by Docker healthcheck and load balancers
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Basic health check
    // You can add database connectivity check here if needed
    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
