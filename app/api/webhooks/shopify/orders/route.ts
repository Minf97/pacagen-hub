import { NextRequest, NextResponse } from 'next/server';
import { extractExperimentInfo, hasValidExperimentData } from '@/lib/shopify/webhook';
import { createEvent, incrementConversionStats } from '@/lib/db/queries';
import { shopifyOrderSchema } from '@/lib/validations/webhook';
import type { EventInsert } from '@/lib/db/schema';
import { createLogger } from '@/lib/logger';

const logger = createLogger('webhook:shopify');

/**
 * POST /api/webhooks/shopify/orders
 *
 * Receives Shopify order creation webhooks and records conversion events
 * for A/B testing analytics
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for HMAC verification
    const rawBody = await request.text();
    const hmacHeader = request.headers.get('x-shopify-hmac-sha256');

    if (!hmacHeader) {
      logger.warn('Missing HMAC header in webhook request');
      return NextResponse.json({ error: 'Missing HMAC signature' }, { status: 401 });
    }

    // Parse order data
    let order;
    try {
      order = JSON.parse(rawBody);
      logger.debug('rawBody', order);
      const validation = shopifyOrderSchema.safeParse(order);
      if (!validation.success) {
        logger.error('Invalid Shopify order data', { error: validation.error });
        return NextResponse.json(
          { error: 'Invalid order data', details: validation.error.format() },
          { status: 400 }
        );
      }
      order = validation.data;
    } catch (parseError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    logger.info('Processing Shopify order', { orderId: order.id });

    // Extract A/B test information
    const experimentInfo = extractExperimentInfo(order);

    logger.debug('Experiment info extracted', { experimentInfo });

    // Check if this order has experiment data
    if (!hasValidExperimentData(experimentInfo)) {
      logger.info('Order has no A/B test data, skipping', { orderId: order.id });
      return NextResponse.json({
        success: true,
        message: 'Order recorded but no experiment data found',
      });
    }

    // Parse variantsGroup (expected format: ["variantId1", "variantId2", ...])
    let variantIds: string[] = [];
    try {
      variantIds = JSON.parse(experimentInfo.variantsGroup);
      if (!Array.isArray(variantIds)) {
        throw new Error('variantsGroup is not an array');
      }
    } catch (parseError) {
      logger.error('Failed to parse variantsGroup', { error: parseError });
      return NextResponse.json({
        success: false,
        message: 'Invalid variantsGroup format',
      }, { status: 400 });
    }

    // Record conversion event with all variant IDs
    const eventData: EventInsert = {
      eventType: 'conversion',
      userId: experimentInfo.userId,
      variantsGroup: variantIds,
      eventData: {
        orderId: experimentInfo.orderId,
        orderValue: experimentInfo.orderValue,
        currency: experimentInfo.currency,
        email: order.email,
        lineItemsCount: order.line_items.length,
      },
      url: null,
      referrer: null,
    };

    // Record conversion event in events table
    await createEvent(eventData);

    // Atomically update experiment stats for each variant using database function
    const today = new Date().toISOString().split('T')[0];

    // Fetch variant details to get experimentIds
    const { getVariantById } = await import('@/lib/db/queries');
    const variantDetailsPromises = variantIds.map(id => getVariantById(id));
    const variantDetailsResults = await Promise.allSettled(variantDetailsPromises);

    const validVariants = variantDetailsResults
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value != null)
      .map(r => r.value);

    // Update stats for each variant
    const statsResults = await Promise.allSettled(
      validVariants.map(variant =>
        incrementConversionStats(variant.experimentId, variant.id, today, experimentInfo.orderValue)
      )
    );

    // Log any stats update failures
    const failures = statsResults.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      logger.error('Some stats updates failed', { failures });
      // Don't fail the webhook, event is already recorded
    }

    logger.info('Conversion recorded successfully', {
      orderId: order.id,
      variantsCount: variantIds.length,
      variantIds
    });

    return NextResponse.json({
      success: true,
      message: 'Conversion recorded successfully',
      data: {
        orderId: experimentInfo.orderId,
        variantsCount: variantIds.length,
        variantIds,
      },
    });
  } catch (error) {
    logger.error('Webhook processing error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/webhooks/shopify/orders
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Shopify orders webhook endpoint is ready',
    timestamp: new Date().toISOString(),
  });
}
