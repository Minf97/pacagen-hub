/**
 * Zod Validation Schemas for Shopify Webhook
 */

import { z } from 'zod';

// =====================================================
// SHOPIFY ORDER WEBHOOK SCHEMA
// =====================================================

export const shopifyLineItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  quantity: z.number(),
  price: z.string(),
  properties: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
      })
    )
    .optional()
    .default([]),
});

export const shopifyOrderSchema = z.object({
  id: z.number(),
  order_number: z.number().optional(),
  email: z.string().email().optional(),
  total_price: z.string(),
  currency: z.string().length(3), // ISO 4217
  line_items: z.array(shopifyLineItemSchema),
  note_attributes: z
    .array(
      z.object({
        name: z.string(),
        value: z.string().nullable(),
      })
    )
    .optional(),
});

export const experimentInfoSchema = z.object({
  userId: z.string(),
  experimentId: z.string().uuid().nullable(),
  variantId: z.string().uuid().nullable(),
  orderId: z.string(),
  orderValue: z.number(),
  currency: z.string(),
});

// =====================================================
// TYPES
// =====================================================

export type ShopifyOrder = z.infer<typeof shopifyOrderSchema>;
export type ShopifyLineItem = z.infer<typeof shopifyLineItemSchema>;
export type ExperimentInfo = z.infer<typeof experimentInfoSchema>;
