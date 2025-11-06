/**
 * Real-time Performance Query Functions
 * Direct queries from page_performance_metrics table (raw data)
 * Calculates percentiles and statistics on-the-fly
 */

import { db } from './client';
import { pagePerformanceMetrics } from './schema';
import { eq, desc, and, sql } from 'drizzle-orm';

/**
 * Get overall performance summary from raw metrics
 * Calculates percentiles directly from individual samples
 */
export async function getOverallPerformanceSummaryRealtime(
  startDate?: string,
  endDate?: string
) {
  const conditions = [];

  if (startDate) {
    conditions.push(sql`${pagePerformanceMetrics.createdAt} >= ${startDate}::date`);
  }
  if (endDate) {
    conditions.push(sql`${pagePerformanceMetrics.createdAt} <= ${endDate}::date + interval '1 day'`);
  }

  const [summary] = await db
    .select({
      totalPages: sql<number>`count(distinct ${pagePerformanceMetrics.pagePath})`,
      totalSamples: sql<number>`count(*)`,
      // Calculate p75 using percentile_cont
      avgLcpP75: sql<number>`percentile_cont(0.75) within group (order by ${pagePerformanceMetrics.lcp})`,
      avgFidP75: sql<number>`percentile_cont(0.75) within group (order by ${pagePerformanceMetrics.fid})`,
      avgClsP75: sql<number>`percentile_cont(0.75) within group (order by ${pagePerformanceMetrics.cls})`,
      avgFcpP75: sql<number>`percentile_cont(0.75) within group (order by ${pagePerformanceMetrics.fcp})`,
      avgTtfbP75: sql<number>`percentile_cont(0.75) within group (order by ${pagePerformanceMetrics.ttfb})`,
      // Calculate good rates (% of samples meeting Web Vitals thresholds)
      avgLcpGoodRate: sql<number>`
        (count(*) filter (where ${pagePerformanceMetrics.lcp} < 2500)::float / count(*) * 100)
      `,
      avgFidGoodRate: sql<number>`
        (count(*) filter (where ${pagePerformanceMetrics.fid} < 100)::float / count(*) * 100)
      `,
      avgClsGoodRate: sql<number>`
        (count(*) filter (where ${pagePerformanceMetrics.cls} < 0.1)::float / count(*) * 100)
      `,
    })
    .from(pagePerformanceMetrics)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return summary;
}

/**
 * Get performance data for all pages from raw metrics
 */
export async function getPerformancePagesRealtime(
  startDate?: string,
  endDate?: string
) {
  const conditions = [];

  if (startDate) {
    conditions.push(sql`${pagePerformanceMetrics.createdAt} >= ${startDate}::date`);
  }
  if (endDate) {
    conditions.push(sql`${pagePerformanceMetrics.createdAt} <= ${endDate}::date + interval '1 day'`);
  }

  return db
    .select({
      pagePath: pagePerformanceMetrics.pagePath,
      totalSamples: sql<number>`count(*)`,
      avgLcpP75: sql<number>`percentile_cont(0.75) within group (order by ${pagePerformanceMetrics.lcp})`,
      avgFidP75: sql<number>`percentile_cont(0.75) within group (order by ${pagePerformanceMetrics.fid})`,
      avgClsP75: sql<number>`percentile_cont(0.75) within group (order by ${pagePerformanceMetrics.cls})`,
      avgFcpP75: sql<number>`percentile_cont(0.75) within group (order by ${pagePerformanceMetrics.fcp})`,
      avgTtfbP75: sql<number>`percentile_cont(0.75) within group (order by ${pagePerformanceMetrics.ttfb})`,
      avgLcpGoodRate: sql<number>`
        (count(*) filter (where ${pagePerformanceMetrics.lcp} < 2500)::float / count(*) * 100)
      `,
      avgFidGoodRate: sql<number>`
        (count(*) filter (where ${pagePerformanceMetrics.fid} < 100)::float / count(*) * 100)
      `,
      avgClsGoodRate: sql<number>`
        (count(*) filter (where ${pagePerformanceMetrics.cls} < 0.1)::float / count(*) * 100)
      `,
    })
    .from(pagePerformanceMetrics)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(pagePerformanceMetrics.pagePath)
    .orderBy(desc(sql<number>`count(*)`));
}

/**
 * Get performance breakdown by device type from raw metrics
 */
export async function getPerformanceByDeviceRealtime(
  startDate?: string,
  endDate?: string
) {
  const conditions = [sql`${pagePerformanceMetrics.deviceType} IS NOT NULL`];

  if (startDate) {
    conditions.push(sql`${pagePerformanceMetrics.createdAt} >= ${startDate}::date`);
  }
  if (endDate) {
    conditions.push(sql`${pagePerformanceMetrics.createdAt} <= ${endDate}::date + interval '1 day'`);
  }

  return db
    .select({
      deviceType: pagePerformanceMetrics.deviceType,
      totalSamples: sql<number>`count(*)`,
      avgLcpP75: sql<number>`percentile_cont(0.75) within group (order by ${pagePerformanceMetrics.lcp})`,
      avgFidP75: sql<number>`percentile_cont(0.75) within group (order by ${pagePerformanceMetrics.fid})`,
      avgClsP75: sql<number>`percentile_cont(0.75) within group (order by ${pagePerformanceMetrics.cls})`,
      avgFcpP75: sql<number>`percentile_cont(0.75) within group (order by ${pagePerformanceMetrics.fcp})`,
      avgTtfbP75: sql<number>`percentile_cont(0.75) within group (order by ${pagePerformanceMetrics.ttfb})`,
    })
    .from(pagePerformanceMetrics)
    .where(and(...conditions))
    .groupBy(pagePerformanceMetrics.deviceType)
    .orderBy(desc(sql<number>`count(*)`));
}

/**
 * Get time series performance data for a specific page from raw metrics
 * Groups by date and calculates daily percentiles
 */
export async function getPerformanceTimeSeriesRealtime(
  pagePath: string,
  startDate?: string,
  endDate?: string,
  deviceType?: string | null
) {
  const conditions = [eq(pagePerformanceMetrics.pagePath, pagePath)];

  if (startDate) {
    conditions.push(sql`${pagePerformanceMetrics.createdAt} >= ${startDate}::date`);
  }
  if (endDate) {
    conditions.push(sql`${pagePerformanceMetrics.createdAt} <= ${endDate}::date + interval '1 day'`);
  }
  if (deviceType !== undefined) {
    if (deviceType === null) {
      // All devices
    } else {
      conditions.push(eq(pagePerformanceMetrics.deviceType, deviceType));
    }
  }

  return db
    .select({
      date: sql<string>`date(${pagePerformanceMetrics.createdAt})`,
      sampleCount: sql<number>`count(*)`,
      lcpP75: sql<number>`percentile_cont(0.75) within group (order by ${pagePerformanceMetrics.lcp})`,
      fidP75: sql<number>`percentile_cont(0.75) within group (order by ${pagePerformanceMetrics.fid})`,
      clsP75: sql<number>`percentile_cont(0.75) within group (order by ${pagePerformanceMetrics.cls})`,
      fcpP75: sql<number>`percentile_cont(0.75) within group (order by ${pagePerformanceMetrics.fcp})`,
      ttfbP75: sql<number>`percentile_cont(0.75) within group (order by ${pagePerformanceMetrics.ttfb})`,
      lcpGoodRate: sql<number>`
        (count(*) filter (where ${pagePerformanceMetrics.lcp} < 2500)::float / count(*) * 100)
      `,
      fidGoodRate: sql<number>`
        (count(*) filter (where ${pagePerformanceMetrics.fid} < 100)::float / count(*) * 100)
      `,
      clsGoodRate: sql<number>`
        (count(*) filter (where ${pagePerformanceMetrics.cls} < 0.1)::float / count(*) * 100)
      `,
    })
    .from(pagePerformanceMetrics)
    .where(and(...conditions))
    .groupBy(sql`date(${pagePerformanceMetrics.createdAt})`)
    .orderBy(sql`date(${pagePerformanceMetrics.createdAt})`);
}
