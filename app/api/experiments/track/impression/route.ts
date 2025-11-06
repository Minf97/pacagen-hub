import { NextResponse } from 'next/server';
import {
  incrementImpression,
  getUserAssignment,
  createUserAssignment,
  getAllUserAssignments
} from '@/lib/db/queries';
import { getDeviceType } from '@/lib/utils/user-agent';
import { logger } from '@/lib/logger';

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

    // Extract user context from request headers
    const userAgent = request.headers.get('User-Agent')
    const deviceType = getDeviceType(userAgent)
    logger.debug('Request headers:', Object.fromEntries(request.headers.entries()))

    // Check if user already has an assignment for this experiment
    const existingAssignment = await getUserAssignment(user_id, experiment_id)

    // If first impression for this experiment, create user assignment record
    if (!existingAssignment) {
      // Check if this user has ANY previous assignments (across all experiments)
      // to determine if they're a new or returning visitor
      const allUserAssignments = await getAllUserAssignments(user_id)
      const isNewVisitor = allUserAssignments.length === 0

      await createUserAssignment({
        userId: user_id,
        experimentId: experiment_id,
        variantId: variant_id,
        assignmentMethod: 'hash', // Hydrogen uses consistent hash
        userAgent: userAgent,
        deviceType: deviceType === 'unknown' ? null : deviceType,
        country: null, // TODO: Add GeoIP lookup in future
        isNewVisitor: isNewVisitor, // Track if this is a first-time visitor
      })

      logger.debug('User assignment created', {
        userId: user_id,
        isNewVisitor,
        totalPreviousAssignments: allUserAssignments.length
      })
    }

    // Record the impression in stats table
    await incrementImpression(
      experiment_id,
      variant_id,
      impressionDate,
      user_id
    );

    return NextResponse.json({
      success: true,
      message: 'Impression recorded successfully',
      debug: {
        isNewUser: !existingAssignment,
        deviceType,
      }
    });

  } catch (error) {
    console.error('[API] Error recording impression:', error);
    return NextResponse.json(
      { error: 'Failed to record impression' },
      { status: 500 }
    );
  }
}
