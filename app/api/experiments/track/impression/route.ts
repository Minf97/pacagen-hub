import { NextResponse } from 'next/server';
import { incrementImpression } from '@/lib/db/queries';

/**
 * POST /api/experiments/track/impression
 * Records an experiment impression (user was assigned to a variant)
 * Used by Hydrogen AB testing system
 *
 * Request Body:
 * {
 *   "experiment_id": "uuid",
 *   "variant_id": "uuid",
 *   "user_id": "string",
 *   "date": "2025-10-25" // Optional, defaults to today
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { experiment_id, variant_id, user_id, date } = body;

    // Validate required fields
    if (!experiment_id || !variant_id || !user_id) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['experiment_id', 'variant_id', 'user_id']
        },
        { status: 400 }
      );
    }

    // Use provided date or default to today
    const impressionDate = date || new Date().toISOString().split('T')[0];

    // Record the impression
    await incrementImpression(
      experiment_id,
      variant_id,
      impressionDate,
      user_id
    );

    return NextResponse.json({
      success: true,
      message: 'Impression recorded successfully'
    });

  } catch (error) {
    console.error('[API] Error recording impression:', error);
    return NextResponse.json(
      { error: 'Failed to record impression' },
      { status: 500 }
    );
  }
}
