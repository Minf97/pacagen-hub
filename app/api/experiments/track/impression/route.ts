import { NextResponse } from 'next/server';
import {
  incrementImpression,
  getUserAssignment,
  createUserAssignment,
  getAllUserAssignments
} from '@/lib/db/queries';
import { getDeviceType } from '@/lib/utils/user-agent';
import { logger } from '@/lib/logger';
import { corsHeaders } from '@/lib/utils/cors';

/**
 * OPTIONS /api/experiments/track/impression
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

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
    const { experiment_id, variant_id, user_id, date, user_agent } = body;

    logger.info('[Impression] Tracking request received', {
      experiment_id,
      variant_id,
      user_id,
      date,
    });

    // Validate required fields
    if (!experiment_id || !variant_id || !user_id) {
      logger.warn('[Impression] Missing required fields', {
        experiment_id,
        variant_id,
        user_id,
      });
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['experiment_id', 'variant_id', 'user_id']
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Use provided date or default to today
    const impressionDate = date || new Date().toISOString().split('T')[0];

    // Extract user context from payload (fallback to headers if not provided)
    const userAgent = user_agent || request.headers.get('User-Agent')
    const deviceType = getDeviceType(userAgent)
    logger.debug('[Impression] Request headers and device', {
      deviceType,
      hasUserAgent: !!userAgent,
    })

    // Check if user already has an assignment for this experiment
    logger.debug('[Impression] Checking existing assignment', {
      user_id,
      experiment_id,
    });
    const existingAssignment = await getUserAssignment(user_id, experiment_id)
    logger.info('[Impression] Existing assignment check result', {
      user_id,
      experiment_id,
      hasExisting: !!existingAssignment,
      existingAssignment: existingAssignment ? {
        variantId: existingAssignment.variantId,
        assignedAt: existingAssignment.assignedAt,
      } : null,
    });

    // If first impression for this experiment, create user assignment record
    if (!existingAssignment) {
      logger.info('[Impression] No existing assignment, creating new one', {
        user_id,
        experiment_id,
        variant_id,
      });

      // Check if this user has ANY previous assignments (across all experiments)
      // to determine if they're a new or returning visitor
      logger.debug('[Impression] Checking all user assignments', { user_id });
      const allUserAssignments = await getAllUserAssignments(user_id)
      logger.info('[Impression] All user assignments fetched', {
        user_id,
        totalAssignments: allUserAssignments.length,
      });
      const isNewVisitor = allUserAssignments.length === 0

      logger.info('[Impression] Creating user assignment', {
        userId: user_id,
        experimentId: experiment_id,
        variantId: variant_id,
        isNewVisitor,
        deviceType,
      });

      try {
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

        logger.info('[Impression] ✅ User assignment created successfully', {
          userId: user_id,
          experimentId: experiment_id,
          variantId: variant_id,
          isNewVisitor,
          totalPreviousAssignments: allUserAssignments.length
        })
      } catch (assignmentError) {
        logger.error('[Impression] ❌ Failed to create user assignment', {
          error: assignmentError instanceof Error ? assignmentError.message : String(assignmentError),
          stack: assignmentError instanceof Error ? assignmentError.stack : undefined,
          userId: user_id,
          experimentId: experiment_id,
          variantId: variant_id,
        });
        throw assignmentError;
      }
    } else {
      logger.info('[Impression] Using existing assignment, skipping creation', {
        user_id,
        experiment_id,
        existingVariantId: existingAssignment.variantId,
        requestedVariantId: variant_id,
        match: existingAssignment.variantId === variant_id,
      });
    }

    // Record the impression in stats table
    logger.debug('[Impression] Recording impression in stats', {
      experiment_id,
      variant_id,
      impressionDate,
      user_id,
    });

    try {
      await incrementImpression(
        experiment_id,
        variant_id,
        impressionDate,
        user_id
      );
      logger.info('[Impression] ✅ Impression recorded in stats', {
        experiment_id,
        variant_id,
        impressionDate,
      });
    } catch (statsError) {
      logger.error('[Impression] ❌ Failed to record impression in stats', {
        error: statsError instanceof Error ? statsError.message : String(statsError),
        stack: statsError instanceof Error ? statsError.stack : undefined,
        experiment_id,
        variant_id,
        impressionDate,
      });
      throw statsError;
    }

    logger.info('[Impression] ✅ Request completed successfully', {
      user_id,
      experiment_id,
      variant_id,
      wasNewAssignment: !existingAssignment,
    });

    return NextResponse.json({
      success: true,
      message: 'Impression recorded successfully',
      debug: {
        isNewUser: !existingAssignment,
        deviceType,
      }
    }, { headers: corsHeaders });

  } catch (error) {
    logger.error('[Impression] ❌ Request failed with error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error,
    });
    console.error('[API] Error recording impression:', error);
    return NextResponse.json(
      {
        error: 'Failed to record impression',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
