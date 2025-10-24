/**
 * Zod Validation Schemas for Experiment API
 */

import { z } from 'zod';

// =====================================================
// EXPERIMENT SCHEMAS
// =====================================================

export const experimentStatusEnum = z.enum(['draft', 'running', 'paused', 'completed', 'archived']);

export const variantSchema = z.object({
  name: z.string().min(1, 'Variant name is required'),
  displayName: z.string().min(1, 'Display name is required'),
  isControl: z.boolean().optional().default(false),
  weight: z.number().int().min(0).max(100),
  config: z.record(z.string(), z.any()).optional().default({}),
});

export const createExperimentSchema = z.object({
  name: z.string().min(1, 'Experiment name is required').max(200),
  description: z.string().optional(),
  hypothesis: z.string().optional(),
  variants: z
    .array(variantSchema)
    .min(2, 'At least 2 variants are required')
    .refine(
      (variants) => {
        const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
        return totalWeight === 100;
      },
      {
        message: 'Total variant weight must equal 100%',
      }
    )
    .refine(
      (variants) => {
        const controlCount = variants.filter((v) => v.isControl).length;
        return controlCount === 1;
      },
      {
        message: 'Exactly one variant must be marked as control',
      }
    ),
});

export const updateExperimentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  hypothesis: z.string().optional().nullable(),
  status: experimentStatusEnum.optional(),
  trafficAllocation: z.record(z.string(), z.number()).optional(),
  targetingRules: z.record(z.string(), z.any()).optional(),
});

export const updateVariantWeightSchema = z.object({
  weight: z.number().int().min(0).max(100),
});

// =====================================================
// EVENT SCHEMAS
// =====================================================

export const eventTypeEnum = z.enum(['exposure', 'click', 'add_to_cart', 'purchase', 'conversion']);

export const createEventSchema = z.object({
  eventType: eventTypeEnum,
  userId: z.string().min(1),
  experimentId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  eventData: z.record(z.string(), z.any()).optional().default({}),
  url: z.string().url().optional(),
  referrer: z.string().url().optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().regex(/^(\d{1,3}\.){3}\d{1,3}$/).optional(),
  country: z.string().length(2).optional(), // ISO 3166-1 alpha-2
});

// =====================================================
// QUERY PARAMETER SCHEMAS
// =====================================================

export const experimentIdParam = z.object({
  id: z.string().uuid('Invalid experiment ID'),
});

export const variantIdParam = z.object({
  id: z.string().uuid('Invalid variant ID'),
});

export const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
});

// =====================================================
// TYPES (inferred from schemas)
// =====================================================

export type ExperimentStatus = z.infer<typeof experimentStatusEnum>;
export type VariantInput = z.infer<typeof variantSchema>;
export type CreateExperimentInput = z.infer<typeof createExperimentSchema>;
export type UpdateExperimentInput = z.infer<typeof updateExperimentSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type EventType = z.infer<typeof eventTypeEnum>;
