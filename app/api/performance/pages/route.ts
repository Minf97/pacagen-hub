import { NextRequest, NextResponse } from 'next/server';
import { getPerformancePagesRealtime as getPerformancePages } from '@/lib/db/performance-queries-realtime';
import { calculateOverallScore } from '@/lib/performance/types';

/**
 * GET /api/performance/pages
 *
 * Get list of all pages with performance data
 * Returns pages ranked by performance score
 *
 * Query params:
 * - startDate: ISO date string (YYYY-MM-DD)
 * - endDate: ISO date string (YYYY-MM-DD)
 * - sortBy: 'score' | 'samples' (default: 'samples')
 * - limit: number (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const sortBy = searchParams.get('sortBy') || 'samples';
    const limit = parseInt(searchParams.get('limit') || '50');

    const pages = await getPerformancePages(startDate, endDate);

    if (pages.length === 0) {
      return NextResponse.json({
        pages: [],
        total: 0,
      });
    }

    // Calculate scores and format results
    const pagesWithScores = pages.map(page => ({
      pagePath: page.pagePath,
      sampleCount: page.totalSamples,
      metrics: {
        lcp: {
          p75: Number(page.avgLcpP75),
          goodRate: Number(page.avgLcpGoodRate),
        },
        fid: {
          p75: Number(page.avgFidP75),
          goodRate: Number(page.avgFidGoodRate),
        },
        cls: {
          p75: Number(page.avgClsP75),
          goodRate: Number(page.avgClsGoodRate),
        },
        fcp: {
          p75: Number(page.avgFcpP75),
        },
        ttfb: {
          p75: Number(page.avgTtfbP75),
        },
      },
      overallScore: calculateOverallScore({
        lcp: Number(page.avgLcpP75),
        fid: Number(page.avgFidP75),
        cls: Number(page.avgClsP75),
        fcp: Number(page.avgFcpP75),
        ttfb: Number(page.avgTtfbP75),
      }),
    }));

    // Sort pages
    const sortedPages = pagesWithScores.sort((a, b) => {
      if (sortBy === 'score') {
        return b.overallScore - a.overallScore;
      } else {
        return b.sampleCount - a.sampleCount;
      }
    });

    // Apply limit
    const limitedPages = sortedPages.slice(0, limit);

    return NextResponse.json({
      pages: limitedPages,
      total: pages.length,
    });

  } catch (error) {
    console.error('[API] Error fetching performance pages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance pages' },
      { status: 500 }
    );
  }
}
