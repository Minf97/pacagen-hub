import { NextResponse } from 'next/server';
import { getActiveExperiments } from '@/lib/db/queries';

/**
 * GET /api/experiments/active
 * Returns all running experiments with their variants
 * Used by Hydrogen AB testing system
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

    return NextResponse.json({
      experiments: transformedExperiments,
    });
  } catch (error) {
    console.error('[API] Error fetching active experiments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active experiments' },
      { status: 500 }
    );
  }
}
