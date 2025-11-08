import { NextRequest, NextResponse } from 'next/server';
import { createPerformanceMetric } from '@/lib/db/queries';
import { getDeviceType } from '@/lib/utils/user-agent';
import type { PerformanceMetricPayload } from '@/lib/performance/types';
import { corsHeaders } from '@/lib/utils/cors';

/**
 * OPTIONS /api/performance/track
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * POST /api/performance/track
 *
 * Receives performance metrics from Hydrogen storefront
 * Stores raw performance data for later aggregation
 *
 * Request Body: PerformanceMetricPayload
 */
export async function POST(request: NextRequest) {
  try {
    const payload: PerformanceMetricPayload = await request.json();

    // Validate required fields
    if (!payload.pageUrl || !payload.pagePath) {
      return NextResponse.json(
        { error: 'Missing required fields: pageUrl, pagePath' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Extract device type from user agent if not provided
    const userAgent = payload.userAgent || request.headers.get('User-Agent');
    const deviceType = payload.deviceType || getDeviceType(userAgent);

    // Parse browser from user agent
    const browser = parseBrowser(userAgent);

    // Store raw metric
    await createPerformanceMetric({
      pageUrl: payload.pageUrl,
      pagePath: payload.pagePath,
      pageTitle: payload.pageTitle,
      sessionId: payload.sessionId,
      userId: payload.userId,
      userAgent: userAgent,
      deviceType: deviceType === 'unknown' ? null : deviceType,
      browser: browser,
      country: payload.country,

      // Core Web Vitals (stored as numeric strings)
      lcp: payload.lcp?.toString(),
      fid: payload.fid?.toString(),
      cls: payload.cls?.toString(),
      fcp: payload.fcp?.toString(),
      ttfb: payload.ttfb?.toString(),
      inp: payload.inp?.toString(),

      // Navigation Timing (convert to integers)
      domContentLoaded: toInteger(payload.domContentLoaded),
      windowLoad: toInteger(payload.windowLoad),
      domInteractive: toInteger(payload.domInteractive),
      tti: toInteger(payload.tti),

      // Resource metrics (convert to integers)
      totalResources: toInteger(payload.totalResources),
      totalTransferSize: toInteger(payload.totalTransferSize),
      jsExecutionTime: payload.jsExecutionTime?.toString(),

      // Network info
      connectionType: payload.connectionType,
      effectiveType: payload.effectiveType,
      referrer: payload.referrer,
    });

    return NextResponse.json({
      success: true,
      message: 'Performance metric recorded successfully',
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[API] Error recording performance metric:', error);
    return NextResponse.json(
      { error: 'Failed to record performance metric' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Parse browser name from user agent
 */
function parseBrowser(userAgent: string | null): string | null {
  if (!userAgent) return null;

  if (userAgent.includes('Chrome') && !userAgent.includes('Edge')) {
    return 'Chrome';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    return 'Safari';
  } else if (userAgent.includes('Firefox')) {
    return 'Firefox';
  } else if (userAgent.includes('Edge')) {
    return 'Edge';
  } else {
    return 'Other';
  }
}

/**
 * Convert a number to integer (round down)
 * Returns undefined if input is null/undefined
 */
function toInteger(value: number | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  return Math.round(value); // Round to nearest integer
}
