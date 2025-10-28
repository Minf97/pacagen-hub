import { NextResponse } from 'next/server';
import { getActiveExperiments } from '@/lib/db/queries';

/**
 * GET /api/experiments/active
 * Returns all running experiments with their variants
 * Used by Hydrogen AB testing system
 *
 * Cache Strategy:
 * - CloudFront caches for 5 minutes (s-maxage=300)
 * - Stale content served for 10 minutes while revalidating (stale-while-revalidate=600)
 * - Browser cache: 1 minute (max-age=60)
 */
export async function GET() {
  try {
    const experiments = await getActiveExperiments();

    // Transform to simplified format for Hydrogen consumption
    const transformedExperiments = experiments.map((exp) => ({
      id: exp.id,
      name: exp.name,
      trafficAllocation: exp.trafficAllocation,
      targetingRules: exp.targetingRules,
    }));

    return NextResponse.json(
      {
        experiments: transformedExperiments,
      },
      {
        headers: {
          // CDN cache for 5 minutes
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600, max-age=60',
          // Help CDN identify cacheable content
          'CDN-Cache-Control': 'public, max-age=300',
        },
      }
    );
  } catch (error) {
    console.error('[API] Error fetching active experiments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active experiments' },
      { status: 500 }
    );
  }
}
