import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  verifyShopifyWebhook,
  extractExperimentInfo,
  hasValidExperimentData,
  type ShopifyOrder,
} from '@/lib/shopify/webhook'
import type { Database } from '@/lib/supabase/types'

type EventInsert = Database['public']['Tables']['events']['Insert']
type ExperimentStatsRow = Database['public']['Tables']['experiment_stats']['Row']
type ExperimentStatsInsert = Database['public']['Tables']['experiment_stats']['Insert']
type ExperimentStatsUpdate = Database['public']['Tables']['experiment_stats']['Update']

/**
 * POST /api/webhooks/shopify/orders
 *
 * Receives Shopify order creation webhooks and records conversion events
 * for A/B testing analytics
 *
 * Webhook Setup in Shopify:
 * 1. Go to Settings → Notifications → Webhooks
 * 2. Create webhook for "Order creation"
 * 3. URL: https://yourdomain.com/api/webhooks/shopify/orders
 * 4. Format: JSON
 * 5. Copy the webhook secret to SHOPIFY_WEBHOOK_SECRET env var
 *
 * Required Order Attributes (set during checkout):
 * - ab_test_user_id: User identifier
 * - ab_test_experiment_id: Experiment UUID
 * - ab_test_variant_id: Variant UUID
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for HMAC verification
    const rawBody = await request.text()
    const hmacHeader = request.headers.get('x-shopify-hmac-sha256')

    // Verify webhook authenticity
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('SHOPIFY_WEBHOOK_SECRET not configured')
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      )
    }

    if (!hmacHeader) {
      console.warn('Missing HMAC header in webhook request')
      return NextResponse.json(
        { error: 'Missing HMAC signature' },
        { status: 401 }
      )
    }

    const isValid = verifyShopifyWebhook(rawBody, hmacHeader, webhookSecret)
    if (!isValid) {
      console.warn('Invalid webhook signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Parse order data
    const order: ShopifyOrder = JSON.parse(rawBody)
    console.log(`Processing Shopify order #${order.id}`)

    // Extract A/B test information
    const experimentInfo = extractExperimentInfo(order)

    // Check if this order has experiment data
    if (!hasValidExperimentData(experimentInfo)) {
      console.log(`Order #${order.id} has no A/B test data, skipping`)
      return NextResponse.json({
        success: true,
        message: 'Order recorded but no experiment data found',
      })
    }

    // Use admin client to bypass RLS for webhook operations
    const supabase = createAdminClient()

    // Record conversion event
    const eventData: EventInsert = {
      event_type: 'conversion',
      user_id: experimentInfo.userId,
      experiment_id: experimentInfo.experimentId!,
      variant_id: experimentInfo.variantId!,
      event_data: {
        order_id: experimentInfo.orderId,
        order_value: experimentInfo.orderValue,
        currency: experimentInfo.currency,
        email: order.email,
        line_items_count: order.line_items.length,
      },
      url: null,
      referrer: null,
    }

    const { error: eventError } = await supabase
      .from('events')
      .insert(eventData)

    if (eventError) {
      console.error('Error recording conversion event:', eventError)
      return NextResponse.json(
        { error: 'Failed to record event' },
        { status: 500 }
      )
    }

    // Update experiment stats
    const today = new Date().toISOString().split('T')[0]

    // First, try to get existing stats for today
    const { data: existingStats, error: fetchError }: { data: any, error: any } = await supabase
      .from('experiment_stats')
      .select('*')
      .eq('experiment_id', experimentInfo.experimentId)
      .eq('variant_id', experimentInfo.variantId)
      .eq('date', today)
      .maybeSingle()

    if (fetchError) {
      console.error('Error fetching stats:', fetchError)
    }

    if (existingStats) {
      // Update existing stats
      const newConversions = existingStats.conversions + 1
      const newRevenue = existingStats.revenue + experimentInfo.orderValue
      const newAvgOrderValue = newRevenue / newConversions
      const newConversionRate = existingStats.impressions > 0
        ? (newConversions / existingStats.impressions) * 100
        : 0

      const updateData: ExperimentStatsUpdate = {
        conversions: newConversions,
        revenue: newRevenue,
        avg_order_value: newAvgOrderValue,
        conversion_rate: newConversionRate,
        updated_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabase
        .from('experiment_stats')
        .update(updateData)
        .eq('experiment_id', experimentInfo.experimentId)
        .eq('variant_id', experimentInfo.variantId)
        .eq('date', today)

      if (updateError) {
        console.error('Error updating stats:', updateError)
        // Don't fail the webhook, event is already recorded
      }
    } else {
      // Create new stats entry
      const insertData: ExperimentStatsInsert = {
        experiment_id: experimentInfo.experimentId,
        variant_id: experimentInfo.variantId,
        date: today,
        conversions: 1,
        revenue: experimentInfo.orderValue,
        avg_order_value: experimentInfo.orderValue,
        impressions: 0, // Will be updated by tracking events
        unique_users: 0,
        clicks: 0,
      }

      const { error: insertError } = await supabase
        .from('experiment_stats')
        .insert(insertData)

      if (insertError) {
        console.error('Error inserting stats:', insertError)
        // Don't fail the webhook, event is already recorded
      }
    }

    console.log(
      `Conversion recorded for experiment ${experimentInfo.experimentId}, variant ${experimentInfo.variantId}`
    )

    return NextResponse.json({
      success: true,
      message: 'Conversion recorded successfully',
      data: {
        order_id: experimentInfo.orderId,
        experiment_id: experimentInfo.experimentId,
        variant_id: experimentInfo.variantId,
      },
    })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
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
  })
}
