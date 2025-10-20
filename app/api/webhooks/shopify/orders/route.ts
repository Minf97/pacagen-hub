import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  extractExperimentInfo,
  hasValidExperimentData,
} from "@/lib/shopify/webhook";
import type { Database } from "@/lib/supabase/types";
import { ShopifyOrder } from "@/types/webhook";

type EventInsert = Database["public"]["Tables"]["events"]["Insert"];

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
    const rawBody = await request.text();
    const hmacHeader = request.headers.get("x-shopify-hmac-sha256");

    if (!hmacHeader) {
      console.warn("Missing HMAC header in webhook request");
      return NextResponse.json(
        { error: "Missing HMAC signature" },
        { status: 401 }
      );
    }

    // console.log(rawBody);

    // Parse order data
    const order: ShopifyOrder = JSON.parse(rawBody);
    console.log(`Processing Shopify order #${order.id}`);

    // Extract A/B test information
    const experimentInfo = extractExperimentInfo(order);

    // Check if this order has experiment data
    if (!hasValidExperimentData(experimentInfo)) {
      console.log(`Order #${order.id} has no A/B test data, skipping`);
      return NextResponse.json({
        success: true,
        message: "Order recorded but no experiment data found",
      });
    }

    const supabase = createAdminClient();

    // Record conversion event
    const eventData: EventInsert = {
      event_type: "conversion",
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
    };

    // Record conversion event in events table
    const { error: eventError } = await supabase
      .from("events")
      .insert(eventData as any); // Type assertion for Supabase

    if (eventError) {
      console.error("Error recording conversion event:", eventError);
      return NextResponse.json(
        { error: "Failed to record event" },
        { status: 500 }
      );
    }

    // Atomically update experiment stats using database function
    // This prevents race conditions when multiple webhooks arrive simultaneously
    const today = new Date().toISOString().split("T")[0];

    const { error: statsError } = await supabase.rpc(
      "increment_conversion_stats",
      {
        p_date: today,
        p_experiment_id: experimentInfo.experimentId!,
        p_order_value: experimentInfo.orderValue,
        p_variant_id: experimentInfo.variantId!,
      } as never
    );

    if (statsError) {
      console.error("Error updating stats:", statsError);
      // Don't fail the webhook, event is already recorded
    }

    console.log(
      `Conversion recorded for experiment ${experimentInfo.experimentId}, variant ${experimentInfo.variantId}`
    );

    return NextResponse.json({
      success: true,
      message: "Conversion recorded successfully",
      data: {
        order_id: experimentInfo.orderId,
        experiment_id: experimentInfo.experimentId,
        variant_id: experimentInfo.variantId,
      },
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/shopify/orders
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Shopify orders webhook endpoint is ready",
    timestamp: new Date().toISOString(),
  });
}
