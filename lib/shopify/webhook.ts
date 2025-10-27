import { ShopifyOrder } from '@/types/webhook'
import crypto from 'crypto'
import { AB_TEST_COOKIE_PREFIX } from '../constants'



/**
 * Extracted A/B Test Information from Order
 */
export interface OrderExperimentInfo {
  userId: string
  variantsGroup: string
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
  console.log(noteAttributes, "noteAttributes");

  const variantsGroup = noteAttributes.find(
    attr => attr.name === `_${AB_TEST_COOKIE_PREFIX}variants_group`
  )?.value

  const userId = noteAttributes.find(
    attr => attr.name === `_${AB_TEST_COOKIE_PREFIX}uid`
  )?.value

  return {
    userId,
    variantsGroup,
    orderId: order.id,
    orderValue: parseFloat(order.total_price),
    currency: order.currency,
  }
}

/**
 * Validate that required experiment fields are present
 */
export function hasValidExperimentData(info: OrderExperimentInfo): boolean {
  return !!(info.userId && info.variantsGroup)
}
