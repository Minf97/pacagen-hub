import { ShopifyOrder } from '@/types/webhook'
import crypto from 'crypto'
import { AB_TEST_COOKIE_PREFIX } from '../constants'
import { logger } from '../logger'



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
 * Looks for experiment data in line_items properties
 *
 * Expected format in line_item properties:
 * [
 *   { name: "_paca_hub_ab_uid", value: "user-id-string" },
 *   { name: "_paca_hub_ab_variants_group", value: "[\"variant-uuid-1\", \"variant-uuid-2\"]" }
 * ]
 *
 * Note: We read from line_items.properties instead of note_attributes
 * because note_attributes can be delayed and empty in some cases.
 */
export function extractExperimentInfo(order: ShopifyOrder): OrderExperimentInfo {
  // Iterate through all line items to find AB test data
  let userId: string | undefined
  let variantsGroup: string | undefined

  const lineItems = order.line_items || []

  for (const lineItem of lineItems) {
    const properties = lineItem.properties || []

    // Find user ID if not already found
    if (!userId) {
      const userIdProp = properties.find(
        prop => prop.name === `_${AB_TEST_COOKIE_PREFIX}uid`
      )
      if (userIdProp && userIdProp.value) {
        userId = userIdProp.value
      }
    }

    // Find variants group if not already found
    if (!variantsGroup) {
      const variantsGroupProp = properties.find(
        prop => prop.name === `_${AB_TEST_COOKIE_PREFIX}variants_group`
      )
      if (variantsGroupProp && variantsGroupProp.value) {
        variantsGroup = variantsGroupProp.value
      }
    }

    // Exit early if we found both
    if (userId && variantsGroup) {
      break
    }
  }

  logger.debug('Extracted AB test info from line_items.properties', {
    userId,
    variantsGroup,
    lineItemsCount: lineItems.length
  })

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
