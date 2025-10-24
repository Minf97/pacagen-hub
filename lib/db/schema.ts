/**
 * Drizzle ORM Schema for Pacagen Hub A/B Testing Framework
 * Converted from Supabase PostgreSQL schema
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  numeric,
  date,
  inet,
  check,
  primaryKey,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// =====================================================
// EXPERIMENTS TABLE
// =====================================================
export const experiments = pgTable(
  'experiments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    hypothesis: text('hypothesis'),

    // Status management
    status: text('status', {
      enum: ['draft', 'running', 'paused', 'completed', 'archived'],
    })
      .notNull()
      .default('draft'),

    // Traffic allocation (JSON for flexibility)
    trafficAllocation: jsonb('traffic_allocation')
      .notNull()
      .default(sql`'[]'::jsonb`),

    // Targeting rules
    targetingRules: jsonb('targeting_rules').default(sql`'{}'::jsonb`),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),

    // Metadata - keeping for future auth integration
    createdBy: uuid('created_by'),
  },
  (table) => ({
    statusIdx: index('idx_experiments_status').on(table.status),
    createdAtIdx: index('idx_experiments_created_at').on(table.createdAt.desc()),
  })
);

// =====================================================
// VARIANTS TABLE
// =====================================================
export const variants = pgTable(
  'variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    experimentId: uuid('experiment_id')
      .notNull()
      .references(() => experiments.id, { onDelete: 'cascade' }),

    // Variant identification
    name: text('name').notNull(), // 'control', 'variant_a', 'variant_b'
    displayName: text('display_name').notNull(), // 'Original Button', 'Green Button'
    isControl: boolean('is_control').default(false).notNull(),

    // Weight for traffic allocation (0-100)
    weight: integer('weight').notNull().default(50),

    // Variant configuration (flexible JSON)
    config: jsonb('config').default(sql`'{}'::jsonb`),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    experimentIdx: index('idx_variants_experiment').on(table.experimentId),
    uniqueExperimentName: unique('unique_experiment_name').on(table.experimentId, table.name),
    weightCheck: check('weight_check', sql`${table.weight} >= 0 AND ${table.weight} <= 100`),
  })
);

// =====================================================
// USER ASSIGNMENTS TABLE
// =====================================================
export const userAssignments = pgTable(
  'user_assignments',
  {
    userId: text('user_id').notNull(), // Cookie ID (persistent)
    experimentId: uuid('experiment_id')
      .notNull()
      .references(() => experiments.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => variants.id, { onDelete: 'cascade' }),

    // Assignment metadata
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
    assignmentMethod: text('assignment_method').default('hash').notNull(), // 'hash', 'manual', 'override'

    // User context at assignment time
    userAgent: text('user_agent'),
    country: text('country'),
    deviceType: text('device_type'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.experimentId] }),
    experimentIdx: index('idx_assignments_experiment').on(table.experimentId),
    variantIdx: index('idx_assignments_variant').on(table.variantId),
    assignedAtIdx: index('idx_assignments_assigned_at').on(table.assignedAt.desc()),
  })
);

// =====================================================
// EVENTS TABLE (High-volume, time-series data)
// =====================================================
export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Event identification
    eventType: text('event_type').notNull(), // 'exposure', 'click', 'add_to_cart', 'purchase', 'conversion'

    // Experiment context
    userId: text('user_id').notNull(),
    experimentId: uuid('experiment_id').references(() => experiments.id, { onDelete: 'set null' }),
    variantId: uuid('variant_id').references(() => variants.id, { onDelete: 'set null' }),

    // Event data (flexible JSON)
    eventData: jsonb('event_data').default(sql`'{}'::jsonb`),

    // Context
    url: text('url'),
    referrer: text('referrer'),
    userAgent: text('user_agent'),
    ipAddress: inet('ip_address'),
    country: text('country'),

    // Timestamp
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    experimentIdx: index('idx_events_experiment').on(table.experimentId, table.createdAt.desc()),
    variantIdx: index('idx_events_variant').on(table.variantId, table.createdAt.desc()),
    typeIdx: index('idx_events_type').on(table.eventType, table.createdAt.desc()),
    userIdx: index('idx_events_user').on(table.userId, table.createdAt.desc()),
  })
);

// =====================================================
// EXPERIMENT STATS TABLE (Aggregated data)
// =====================================================
export const experimentStats = pgTable(
  'experiment_stats',
  {
    experimentId: uuid('experiment_id')
      .notNull()
      .references(() => experiments.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => variants.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),

    // Core metrics
    impressions: integer('impressions').default(0).notNull(),
    uniqueUsers: integer('unique_users').default(0).notNull(),
    clicks: integer('clicks').default(0).notNull(),
    conversions: integer('conversions').default(0).notNull(),

    // Revenue metrics
    revenue: numeric('revenue', { precision: 12, scale: 2 }).default('0').notNull(),
    avgOrderValue: numeric('avg_order_value', { precision: 12, scale: 2 }).default('0').notNull(),

    // Engagement metrics
    bounceRate: numeric('bounce_rate', { precision: 5, scale: 2 }),
    avgSessionDuration: integer('avg_session_duration'), // seconds

    // Statistical data
    conversionRate: numeric('conversion_rate', { precision: 5, scale: 4 }),
    confidenceLevel: numeric('confidence_level', { precision: 5, scale: 4 }),
    pValue: numeric('p_value', { precision: 10, scale: 8 }),

    // Timestamps
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.experimentId, table.variantId, table.date] }),
    dateIdx: index('idx_stats_date').on(table.date.desc()),
    experimentIdx: index('idx_stats_experiment').on(table.experimentId, table.date.desc()),
  })
);

// =====================================================
// RELATIONS (for Drizzle queries)
// =====================================================
export const experimentsRelations = relations(experiments, ({ many }) => ({
  variants: many(variants),
  userAssignments: many(userAssignments),
  events: many(events),
  stats: many(experimentStats),
}));

export const variantsRelations = relations(variants, ({ one, many }) => ({
  experiment: one(experiments, {
    fields: [variants.experimentId],
    references: [experiments.id],
  }),
  userAssignments: many(userAssignments),
  events: many(events),
  stats: many(experimentStats),
}));

export const userAssignmentsRelations = relations(userAssignments, ({ one }) => ({
  experiment: one(experiments, {
    fields: [userAssignments.experimentId],
    references: [experiments.id],
  }),
  variant: one(variants, {
    fields: [userAssignments.variantId],
    references: [variants.id],
  }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  experiment: one(experiments, {
    fields: [events.experimentId],
    references: [experiments.id],
  }),
  variant: one(variants, {
    fields: [events.variantId],
    references: [variants.id],
  }),
}));

export const experimentStatsRelations = relations(experimentStats, ({ one }) => ({
  experiment: one(experiments, {
    fields: [experimentStats.experimentId],
    references: [experiments.id],
  }),
  variant: one(variants, {
    fields: [experimentStats.variantId],
    references: [variants.id],
  }),
}));

// =====================================================
// TYPE EXPORTS (TypeScript types inferred from schema)
// =====================================================
export type Experiment = typeof experiments.$inferSelect;
export type ExperimentInsert = typeof experiments.$inferInsert;

export type Variant = typeof variants.$inferSelect;
export type VariantInsert = typeof variants.$inferInsert;

export type UserAssignment = typeof userAssignments.$inferSelect;
export type UserAssignmentInsert = typeof userAssignments.$inferInsert;

export type Event = typeof events.$inferSelect;
export type EventInsert = typeof events.$inferInsert;

export type ExperimentStat = typeof experimentStats.$inferSelect;
export type ExperimentStatInsert = typeof experimentStats.$inferInsert;

// Extended types with relations
export type ExperimentWithVariants = Experiment & {
  variants: Variant[];
};

export type ExperimentWithStats = Experiment & {
  variants: (Variant & {
    stats: ExperimentStat[];
  })[];
};
