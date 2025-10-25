/**
 * Database Query Functions Layer
 * All database operations abstracted into reusable functions
 */

import { db } from './client';
import {
  experiments,
  variants,
  userAssignments,
  events,
  experimentStats,
  type Experiment,
  type ExperimentInsert,
  type Variant,
  type VariantInsert,
  type Event,
  type EventInsert,
  type ExperimentStat,
  type UserAssignmentInsert,
} from './schema';
import { eq, desc, and, sql } from 'drizzle-orm';

// =====================================================
// EXPERIMENTS
// =====================================================

export async function getAllExperiments() {
  return db.query.experiments.findMany({
    with: {
      variants: true,
    },
    orderBy: [desc(experiments.createdAt)],
  });
}

export async function getExperimentById(id: string) {
  return db.query.experiments.findFirst({
    where: eq(experiments.id, id),
    with: {
      variants: true,
    },
  });
}

export async function createExperiment(data: ExperimentInsert) {
  const [experiment] = await db.insert(experiments).values(data).returning();
  return experiment;
}

/**
 * Create experiment and variants in a single transaction
 * Optimized to use one database connection and ensure atomicity
 */
export async function createExperimentWithVariants(
  experimentData: ExperimentInsert,
  variantsData: Omit<VariantInsert, 'experimentId'>[]
) {
  return db.transaction(async (tx) => {
    // Insert experiment
    const [experiment] = await tx.insert(experiments).values(experimentData).returning();

    // Insert all variants with the experiment ID
    const createdVariants = await tx.insert(variants).values(
      variantsData.map(v => ({
        ...v,
        experimentId: experiment.id
      }))
    ).returning();

    // Build trafficAllocation array with variant IDs
    const trafficAllocation = createdVariants.map(v => ({
      id: v.id,
      name: v.name,
      enable: true,
      weight: v.weight
    }));

    // Update experiment with correct trafficAllocation
    const [updatedExperiment] = await tx
      .update(experiments)
      .set({ trafficAllocation })
      .where(eq(experiments.id, experiment.id))
      .returning();

    return {
      experiment: updatedExperiment,
      variants: createdVariants
    };
  });
}

export async function updateExperiment(id: string, data: Partial<ExperimentInsert>) {
  const [experiment] = await db
    .update(experiments)
    .set(data)
    .where(eq(experiments.id, id))
    .returning();
  return experiment;
}

export async function deleteExperiment(id: string) {
  await db.delete(experiments).where(eq(experiments.id, id));
}

// =====================================================
// VARIANTS
// =====================================================

export async function getVariantsByExperimentId(experimentId: string) {
  return db.query.variants.findMany({
    where: eq(variants.experimentId, experimentId),
  });
}

export async function getVariantById(id: string) {
  return db.query.variants.findFirst({
    where: eq(variants.id, id),
  });
}

export async function createVariants(data: VariantInsert[]) {
  return db.insert(variants).values(data).returning();
}

export async function updateVariant(id: string, data: Partial<VariantInsert>) {
  const [variant] = await db
    .update(variants)
    .set(data)
    .where(eq(variants.id, id))
    .returning();
  return variant;
}

export async function deleteVariant(id: string) {
  await db.delete(variants).where(eq(variants.id, id));
}

// =====================================================
// USER ASSIGNMENTS
// =====================================================

export async function getUserAssignment(userId: string, experimentId: string) {
  return db.query.userAssignments.findFirst({
    where: and(
      eq(userAssignments.userId, userId),
      eq(userAssignments.experimentId, experimentId)
    ),
  });
}

export async function createUserAssignment(data: UserAssignmentInsert) {
  const [assignment] = await db.insert(userAssignments).values(data).returning();
  return assignment;
}

// =====================================================
// EVENTS
// =====================================================

export async function createEvent(data: EventInsert) {
  const [event] = await db.insert(events).values(data).returning();
  return event;
}

export async function getEventsByExperiment(experimentId: string, limit = 100) {
  return db.query.events.findMany({
    where: eq(events.experimentId, experimentId),
    orderBy: [desc(events.createdAt)],
    limit,
  });
}

// =====================================================
// EXPERIMENT STATS
// =====================================================

export async function getExperimentStats(experimentId: string, variantId?: string) {
  const conditions = [eq(experimentStats.experimentId, experimentId)];

  if (variantId) {
    conditions.push(eq(experimentStats.variantId, variantId));
  }

  return db.query.experimentStats.findMany({
    where: and(...conditions),
    orderBy: [desc(experimentStats.date)],
  });
}

export async function getVariantTotals(experimentId: string) {
  return db
    .select({
      variantId: experimentStats.variantId,
      totalVisitors: sql<number>`sum(${experimentStats.uniqueUsers})`,
      totalImpressions: sql<number>`sum(${experimentStats.impressions})`,
      totalClicks: sql<number>`sum(${experimentStats.clicks})`,
      totalOrders: sql<number>`sum(${experimentStats.conversions})`,
      totalRevenue: sql<string>`sum(${experimentStats.revenue})`,
      dayCount: sql<number>`count(distinct ${experimentStats.date})`,
    })
    .from(experimentStats)
    .where(eq(experimentStats.experimentId, experimentId))
    .groupBy(experimentStats.variantId);
}

export async function getExperimentTimeSeries(experimentId: string) {
  return db
    .select({
      date: experimentStats.date,
      variantId: experimentStats.variantId,
      visitors: experimentStats.uniqueUsers,
      impressions: experimentStats.impressions,
      clicks: experimentStats.clicks,
      orders: experimentStats.conversions,
      revenue: experimentStats.revenue,
    })
    .from(experimentStats)
    .where(eq(experimentStats.experimentId, experimentId))
    .orderBy(experimentStats.date, experimentStats.variantId);
}

// =====================================================
// ATOMIC STATS UPDATE (using database function)
// =====================================================

export async function incrementConversionStats(
  experimentId: string,
  variantId: string,
  date: string,
  orderValue: number
) {
  await db.execute(
    sql`SELECT increment_conversion_stats(
      ${experimentId}::uuid,
      ${variantId}::uuid,
      ${date}::date,
      ${orderValue}::numeric
    )`
  );
}

export async function incrementImpression(
  experimentId: string,
  variantId: string,
  date: string,
  userId: string
) {
  await db.execute(
    sql`SELECT increment_impression(
      ${experimentId}::uuid,
      ${variantId}::uuid,
      ${date}::date,
      ${userId}::text
    )`
  );
}

// =====================================================
// EXPERIMENT WITH FULL STATS (complex query)
// =====================================================

export async function getExperimentWithStats(experimentId: string) {
  const experiment = await getExperimentById(experimentId);

  if (!experiment) {
    return null;
  }

  const stats = await getVariantTotals(experimentId);
  const timeSeries = await getExperimentTimeSeries(experimentId);

  return {
    ...experiment,
    stats,
    timeSeries,
  };
}

// =====================================================
// EXPERIMENT SUMMARY (dashboard view)
// =====================================================

export async function getExperimentSummary() {
  return db
    .select({
      id: experiments.id,
      name: experiments.name,
      status: experiments.status,
      startedAt: experiments.startedAt,
      endedAt: experiments.endedAt,
      totalUsers: sql<number>`count(distinct ${userAssignments.userId})`,
      variantCount: sql<number>`count(distinct ${variants.id})`,
      totalImpressions: sql<number>`coalesce(sum(${experimentStats.impressions}), 0)`,
      totalConversions: sql<number>`coalesce(sum(${experimentStats.conversions}), 0)`,
      totalRevenue: sql<string>`coalesce(sum(${experimentStats.revenue}), 0)`,
    })
    .from(experiments)
    .leftJoin(variants, eq(experiments.id, variants.experimentId))
    .leftJoin(userAssignments, eq(experiments.id, userAssignments.experimentId))
    .leftJoin(experimentStats, eq(experiments.id, experimentStats.experimentId))
    .groupBy(experiments.id, experiments.name, experiments.status, experiments.startedAt, experiments.endedAt)
    .orderBy(desc(experiments.createdAt));
}

// =====================================================
// ACTIVE EXPERIMENTS (for Hydrogen AB testing)
// =====================================================

export async function getActiveExperiments() {
  return db.query.experiments.findMany({
    where: eq(experiments.status, 'running'),
    with: {
      variants: true,
    },
    orderBy: [desc(experiments.createdAt)],
  });
}
