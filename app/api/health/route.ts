/**
 * Health Check API
 * Used by Docker healthcheck, load balancers, and deployment validation
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  const startTime = Date.now();

  try {
    // Database connectivity check
    let dbStatus = 'disconnected';
    let dbLatency = 0;

    try {
      const dbStartTime = Date.now();
      await db.execute(sql`SELECT 1`);
      dbLatency = Date.now() - dbStartTime;
      dbStatus = 'connected';
    } catch (dbError) {
      console.error('Database health check failed:', dbError);
      dbStatus = 'error';
    }

    // Get container info (for blue-green deployment tracking)
    const containerColor = process.env.CONTAINER_COLOR || 'unknown';

    // Build version info
    const version = process.env.npm_package_version || '1.0.0';

    // Overall health status
    const isHealthy = dbStatus === 'connected';

    return NextResponse.json(
      {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        version,
        container: containerColor,
        checks: {
          database: {
            status: dbStatus,
            latency: `${dbLatency}ms`,
          },
          memory: {
            used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
            total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
          },
        },
        responseTime: `${Date.now() - startTime}ms`,
      },
      {
        status: isHealthy ? 200 : 503,
        headers: {
          // Never cache health checks
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Container-Color': containerColor,
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        container: process.env.CONTAINER_COLOR || 'unknown',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }
}
