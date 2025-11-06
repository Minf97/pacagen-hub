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

export async function getAllUserAssignments(userId: string) {
  return db.query.userAssignments.findMany({
    where: eq(userAssignments.userId, userId),
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
  // First get all variant IDs for this experiment
  const experimentVariants = await getVariantsByExperimentId(experimentId);
  const variantIds = experimentVariants.map(v => v.id);

  if (variantIds.length === 0) {
    return [];
  }

  // Query events where variantsGroup overlaps with our variant IDs
  return db.query.events.findMany({
    where: sql`${events.variantsGroup} && ARRAY[${sql.join(variantIds.map(id => sql`${id}::text`), sql`, `)}]::text[]`,
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
      totalVisitors: sql<number>`max(${experimentStats.uniqueUsers})`, // 取最大值（最新的累计数）
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

/**
 * Get variant totals segmented by device type
 * Aggregates statistics from user assignments and events
 */
export async function getVariantTotalsByDevice(experimentId: string, deviceType: 'desktop' | 'mobile') {
  // Get visitor counts from user_assignments
  const visitorStats = await db
    .select({
      variantId: userAssignments.variantId,
      totalVisitors: sql<number>`count(distinct ${userAssignments.userId})`,
    })
    .from(userAssignments)
    .where(
      and(
        eq(userAssignments.experimentId, experimentId),
        eq(userAssignments.deviceType, deviceType)
      )
    )
    .groupBy(userAssignments.variantId);

  // Get conversion metrics from events joined with user_assignments
  const conversionStats = await db
    .select({
      variantId: userAssignments.variantId,
      totalOrders: sql<number>`count(distinct ${events.id})`,
      totalRevenue: sql<string>`coalesce(sum(cast(${events.eventData}->>'orderValue' as numeric)), 0)`,
    })
    .from(events)
    .innerJoin(
      userAssignments,
      and(
        eq(events.userId, userAssignments.userId),
        eq(userAssignments.experimentId, experimentId),
        eq(userAssignments.deviceType, deviceType)
      )
    )
    .where(eq(events.eventType, 'conversion'))
    .groupBy(userAssignments.variantId);

  // Merge visitor and conversion stats
  const conversionMap = new Map(
    conversionStats.map(stat => [stat.variantId, stat])
  );

  return visitorStats.map(visitor => ({
    variantId: visitor.variantId,
    totalVisitors: visitor.totalVisitors,
    totalImpressions: visitor.totalVisitors, // Use visitors as impressions approximation
    totalClicks: 0, // Not tracked in current schema
    totalOrders: conversionMap.get(visitor.variantId)?.totalOrders || 0,
    totalRevenue: conversionMap.get(visitor.variantId)?.totalRevenue || '0',
    dayCount: 0, // Not applicable for device segmentation
  }));
}

/**
 * Get variant totals segmented by visitor type (new vs returning)
 * Aggregates statistics from user assignments and events
 */
export async function getVariantTotalsByVisitorType(
  experimentId: string,
  visitorType: 'new' | 'returning'
) {
  const isNewVisitor = visitorType === 'new'

  // Get visitor counts from user_assignments
  const visitorStats = await db
    .select({
      variantId: userAssignments.variantId,
      totalVisitors: sql<number>`count(distinct ${userAssignments.userId})`,
    })
    .from(userAssignments)
    .where(
      and(
        eq(userAssignments.experimentId, experimentId),
        eq(userAssignments.isNewVisitor, isNewVisitor)
      )
    )
    .groupBy(userAssignments.variantId);

  // Get conversion metrics from events joined with user_assignments
  const conversionStats = await db
    .select({
      variantId: userAssignments.variantId,
      totalOrders: sql<number>`count(distinct ${events.id})`,
      totalRevenue: sql<string>`coalesce(sum(cast(${events.eventData}->>'orderValue' as numeric)), 0)`,
    })
    .from(events)
    .innerJoin(
      userAssignments,
      and(
        eq(events.userId, userAssignments.userId),
        eq(userAssignments.experimentId, experimentId),
        eq(userAssignments.isNewVisitor, isNewVisitor)
      )
    )
    .where(eq(events.eventType, 'conversion'))
    .groupBy(userAssignments.variantId);

  // Merge visitor and conversion stats
  const conversionMap = new Map(
    conversionStats.map(stat => [stat.variantId, stat])
  );

  return visitorStats.map(visitor => ({
    variantId: visitor.variantId,
    totalVisitors: visitor.totalVisitors,
    totalImpressions: visitor.totalVisitors, // Use visitors as impressions approximation
    totalClicks: 0, // Not tracked in current schema
    totalOrders: conversionMap.get(visitor.variantId)?.totalOrders || 0,
    totalRevenue: conversionMap.get(visitor.variantId)?.totalRevenue || '0',
    dayCount: 0, // Not applicable for visitor type segmentation
  }));
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

// =====================================================
// PAGE PERFORMANCE METRICS
// =====================================================

import {
  pagePerformanceMetrics,
  pagePerformanceStats,
  type PagePerformanceMetric,
  type PagePerformanceMetricInsert,
  type PagePerformanceStat,
} from './schema';

/**
 * Create a performance metric record
 */
export async function createPerformanceMetric(data: PagePerformanceMetricInsert) {
  const [metric] = await db.insert(pagePerformanceMetrics).values(data).returning();
  return metric;
}

/**
 * Get performance metrics for a specific page
 */
export async function getPerformanceMetricsByPage(
  pagePath: string,
  limit = 100,
  startDate?: string,
  endDate?: string
) {
  const conditions = [eq(pagePerformanceMetrics.pagePath, pagePath)];

  if (startDate) {
    conditions.push(sql`${pagePerformanceMetrics.createdAt} >= ${startDate}::timestamp`);
  }
  if (endDate) {
    conditions.push(sql`${pagePerformanceMetrics.createdAt} <= ${endDate}::timestamp`);
  }

  return db.query.pagePerformanceMetrics.findMany({
    where: and(...conditions),
    orderBy: [desc(pagePerformanceMetrics.createdAt)],
    limit,
  });
}

/**
 * Get aggregated stats for a page within a date range
 */
export async function getPagePerformanceStats(
  pagePath?: string,
  startDate?: string,
  endDate?: string,
  deviceType?: string | null
) {
  const conditions = [];

  if (pagePath) {
    conditions.push(eq(pagePerformanceStats.pagePath, pagePath));
  }
  if (startDate) {
    conditions.push(sql`${pagePerformanceStats.date} >= ${startDate}::date`);
  }
  if (endDate) {
    conditions.push(sql`${pagePerformanceStats.date} <= ${endDate}::date`);
  }
  if (deviceType !== undefined) {
    if (deviceType === null) {
      conditions.push(sql`${pagePerformanceStats.deviceType} IS NULL`);
    } else {
      conditions.push(eq(pagePerformanceStats.deviceType, deviceType));
    }
  }

  return db.query.pagePerformanceStats.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(pagePerformanceStats.date)],
  });
}

/**
 * Get list of all pages with performance data
 */
export async function getPerformancePages(startDate?: string, endDate?: string) {
  const conditions = [];

  if (startDate) {
    conditions.push(sql`${pagePerformanceStats.date} >= ${startDate}::date`);
  }
  if (endDate) {
    conditions.push(sql`${pagePerformanceStats.date} <= ${endDate}::date`);
  }

  return db
    .select({
      pagePath: pagePerformanceStats.pagePath,
      totalSamples: sql<number>`sum(${pagePerformanceStats.sampleCount})`,
      avgLcpP75: sql<number>`avg(${pagePerformanceStats.lcpP75})`,
      avgFidP75: sql<number>`avg(${pagePerformanceStats.fidP75})`,
      avgClsP75: sql<number>`avg(${pagePerformanceStats.clsP75})`,
      avgFcpP75: sql<number>`avg(${pagePerformanceStats.fcpP75})`,
      avgTtfbP75: sql<number>`avg(${pagePerformanceStats.ttfbP75})`,
      avgLcpGoodRate: sql<number>`avg(${pagePerformanceStats.lcpGoodRate})`,
      avgFidGoodRate: sql<number>`avg(${pagePerformanceStats.fidGoodRate})`,
      avgClsGoodRate: sql<number>`avg(${pagePerformanceStats.clsGoodRate})`,
    })
    .from(pagePerformanceStats)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(pagePerformanceStats.pagePath)
    .orderBy(desc(sql<number>`sum(${pagePerformanceStats.sampleCount})`));
}

/**
 * Get performance stats by device type
 */
export async function getPerformanceByDevice(startDate?: string, endDate?: string) {
  const conditions = [sql`${pagePerformanceStats.deviceType} IS NOT NULL`];

  if (startDate) {
    conditions.push(sql`${pagePerformanceStats.date} >= ${startDate}::date`);
  }
  if (endDate) {
    conditions.push(sql`${pagePerformanceStats.date} <= ${endDate}::date`);
  }

  return db
    .select({
      deviceType: pagePerformanceStats.deviceType,
      totalSamples: sql<number>`sum(${pagePerformanceStats.sampleCount})`,
      avgLcpP75: sql<number>`avg(${pagePerformanceStats.lcpP75})`,
      avgFidP75: sql<number>`avg(${pagePerformanceStats.fidP75})`,
      avgClsP75: sql<number>`avg(${pagePerformanceStats.clsP75})`,
      avgFcpP75: sql<number>`avg(${pagePerformanceStats.fcpP75})`,
      avgTtfbP75: sql<number>`avg(${pagePerformanceStats.ttfbP75})`,
    })
    .from(pagePerformanceStats)
    .where(and(...conditions))
    .groupBy(pagePerformanceStats.deviceType)
    .orderBy(desc(sql<number>`sum(${pagePerformanceStats.sampleCount})`));
}

/**
 * Get time series performance data for a page
 */
export async function getPerformanceTimeSeries(
  pagePath: string,
  startDate?: string,
  endDate?: string,
  deviceType?: string | null
) {
  const conditions = [eq(pagePerformanceStats.pagePath, pagePath)];

  if (startDate) {
    conditions.push(sql`${pagePerformanceStats.date} >= ${startDate}::date`);
  }
  if (endDate) {
    conditions.push(sql`${pagePerformanceStats.date} <= ${endDate}::date`);
  }
  if (deviceType !== undefined) {
    if (deviceType === null) {
      conditions.push(sql`${pagePerformanceStats.deviceType} IS NULL`);
    } else {
      conditions.push(eq(pagePerformanceStats.deviceType, deviceType));
    }
  }

  return db
    .select({
      date: pagePerformanceStats.date,
      sampleCount: pagePerformanceStats.sampleCount,
      lcpP75: pagePerformanceStats.lcpP75,
      fidP75: pagePerformanceStats.fidP75,
      clsP75: pagePerformanceStats.clsP75,
      fcpP75: pagePerformanceStats.fcpP75,
      ttfbP75: pagePerformanceStats.ttfbP75,
      lcpGoodRate: pagePerformanceStats.lcpGoodRate,
      fidGoodRate: pagePerformanceStats.fidGoodRate,
      clsGoodRate: pagePerformanceStats.clsGoodRate,
    })
    .from(pagePerformanceStats)
    .where(and(...conditions))
    .orderBy(pagePerformanceStats.date);
}

/**
 * Get overall performance summary across all pages
 */
export async function getOverallPerformanceSummary(startDate?: string, endDate?: string) {
  const conditions = [sql`${pagePerformanceStats.deviceType} IS NULL`]; // Only use aggregated (all devices) stats

  if (startDate) {
    conditions.push(sql`${pagePerformanceStats.date} >= ${startDate}::date`);
  }
  if (endDate) {
    conditions.push(sql`${pagePerformanceStats.date} <= ${endDate}::date`);
  }

  const [summary] = await db
    .select({
      totalPages: sql<number>`count(distinct ${pagePerformanceStats.pagePath})`,
      totalSamples: sql<number>`sum(${pagePerformanceStats.sampleCount})`,
      avgLcpP75: sql<number>`avg(${pagePerformanceStats.lcpP75})`,
      avgFidP75: sql<number>`avg(${pagePerformanceStats.fidP75})`,
      avgClsP75: sql<number>`avg(${pagePerformanceStats.clsP75})`,
      avgFcpP75: sql<number>`avg(${pagePerformanceStats.fcpP75})`,
      avgTtfbP75: sql<number>`avg(${pagePerformanceStats.ttfbP75})`,
      avgLcpGoodRate: sql<number>`avg(${pagePerformanceStats.lcpGoodRate})`,
      avgFidGoodRate: sql<number>`avg(${pagePerformanceStats.fidGoodRate})`,
      avgClsGoodRate: sql<number>`avg(${pagePerformanceStats.clsGoodRate})`,
    })
    .from(pagePerformanceStats)
    .where(and(...conditions));

  return summary;
}
