import crypto from 'crypto'

/**
 * Shopify Order Webhook Payload Types
 */
export interface ShopifyOrder {
  id: number
  email: string
  created_at: string
  total_price: string
  currency: string
  customer: {
    id: number
    email: string
    first_name: string
    last_name: string
  }
  line_items: Array<{
    id: number
    title: string
    quantity: number
    price: string
    product_id: number
    variant_id: number
  }>
  note_attributes?: Array<{
    name: string
    value: string
  }>
  // Add other fields as needed
}

/**
 * Extracted A/B Test Information from Order
 */
export interface OrderExperimentInfo {
  userId: string
  experimentId?: string
  variantId?: string
  orderId: number
  orderValue: number
  currency: string
}

/**
 * Verify Shopify webhook HMAC signature
 * @param body - Raw request body string
 * @param hmacHeader - HMAC signature from Shopify (X-Shopify-Hmac-Sha256 header)
 * @param secret - Shopify webhook secret
 * @returns Boolean indicating if signature is valid
 */
export function verifyShopifyWebhook(
  body: string,
  hmacHeader: string,
  secret: string
): boolean {
  try {
    const hash = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64')

    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(hmacHeader)
    )
  } catch (error) {
    console.error('Webhook verification error:', error)
    return false
  }
}

/**
 * Extract A/B test information from Shopify order
 * Looks for experiment data in:
 * 1. note_attributes (custom order attributes)
 * 2. customer.note (customer notes)
 *
 * Expected format in note_attributes:
 * [
 *   { name: "ab_test_experiment_id", value: "uuid" },
 *   { name: "ab_test_variant_id", value: "uuid" },
 *   { name: "ab_test_user_id", value: "uuid" }
 * ]
 */
export function extractExperimentInfo(order: ShopifyOrder): OrderExperimentInfo {
  const noteAttributes = order.note_attributes || []

  // Extract from note_attributes
  const experimentId = noteAttributes.find(
    attr => attr.name === 'ab_test_experiment_id'
  )?.value

  const variantId = noteAttributes.find(
    attr => attr.name === 'ab_test_variant_id'
  )?.value

  const userId = noteAttributes.find(
    attr => attr.name === 'ab_test_user_id'
  )?.value || `customer_${order.customer.id}`

  return {
    userId,
    experimentId,
    variantId,
    orderId: order.id,
    orderValue: parseFloat(order.total_price),
    currency: order.currency,
  }
}

/**
 * Validate that required experiment fields are present
 */
export function hasValidExperimentData(info: OrderExperimentInfo): boolean {
  return !!(info.userId && info.experimentId && info.variantId)
}
