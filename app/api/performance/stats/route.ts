import { NextRequest, NextResponse } from 'next/server';
import {
  getOverallPerformanceSummaryRealtime as getOverallPerformanceSummary,
  getPerformancePagesRealtime as getPerformancePages,
  getPerformanceByDeviceRealtime as getPerformanceByDevice,
  getPerformanceTimeSeriesRealtime as getPerformanceTimeSeries,
} from '@/lib/db/performance-queries-realtime';
import {
  calculateOverallScore,
  getWebVitalScore,
  type PagePerformanceStats,
  type PerformanceSummary,
  type PercentileMetric,
} from '@/lib/performance/types';

/**
 * GET /api/performance/stats
 *
 * Get aggregated performance statistics
 * Supports filtering by date range and page
 *
 * Query params:
 * - startDate: ISO date string (YYYY-MM-DD)
 * - endDate: ISO date string (YYYY-MM-DD)
 * - pagePath: specific page path (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const pagePath = searchParams.get('pagePath') || undefined;

    // If requesting specific page stats
    if (pagePath) {
      const timeSeriesData = await getPerformanceTimeSeries(
        pagePath,
        startDate,
        endDate,
        null // all devices
      );

      if (timeSeriesData.length === 0) {
        return NextResponse.json({
          pagePath,
          stats: null,
          timeSeries: [],
        });
      }

      // Calculate aggregated stats from time series
      const totalSamples = timeSeriesData.reduce((sum, d) => sum + d.sampleCount, 0);
      const avgLcp = average(timeSeriesData.map(d => Number(d.lcpP75)));
      const avgFid = average(timeSeriesData.map(d => Number(d.fidP75)));
      const avgCls = average(timeSeriesData.map(d => Number(d.clsP75)));
      const avgFcp = average(timeSeriesData.map(d => Number(d.fcpP75)));
      const avgTtfb = average(timeSeriesData.map(d => Number(d.ttfbP75)));

      const stats: PagePerformanceStats = {
        pagePath,
        sampleCount: totalSamples,
        lcp: createPercentileMetric(avgLcp, 'LCP'),
        fid: createPercentileMetric(avgFid, 'FID'),
        cls: createPercentileMetric(avgCls, 'CLS'),
        fcp: createPercentileMetric(avgFcp, 'FCP'),
        ttfb: createPercentileMetric(avgTtfb, 'TTFB'),
        inp: createPercentileMetric(0, 'INP'), // Not tracked yet
        avgDomContentLoaded: 0,
        avgWindowLoad: 0,
        avgDomInteractive: 0,
        lcpGoodRate: average(timeSeriesData.map(d => Number(d.lcpGoodRate))),
        fidGoodRate: average(timeSeriesData.map(d => Number(d.fidGoodRate))),
        clsGoodRate: average(timeSeriesData.map(d => Number(d.clsGoodRate))),
        overallScore: calculateOverallScore({
          lcp: avgLcp,
          fid: avgFid,
          cls: avgCls,
          fcp: avgFcp,
          ttfb: avgTtfb,
        }),
      };

      return NextResponse.json({
        pagePath,
        stats,
        timeSeries: timeSeriesData,
      });
    }

    // Otherwise, return overall summary
    const summary = await getOverallPerformanceSummary(startDate, endDate);
    const pages = await getPerformancePages(startDate, endDate);
    const deviceBreakdown = await getPerformanceByDevice(startDate, endDate);

    if (!summary || summary.totalPages === 0) {
      return NextResponse.json({
        summary: {
          totalPages: 0,
          totalSamples: 0,
          dateRange: { start: startDate || '', end: endDate || '' },
          overallLcp: createPercentileMetric(0, 'LCP'),
          overallFid: createPercentileMetric(0, 'FID'),
          overallCls: createPercentileMetric(0, 'CLS'),
          overallFcp: createPercentileMetric(0, 'FCP'),
          overallTtfb: createPercentileMetric(0, 'TTFB'),
          pagesPassingCoreWebVitals: 0,
          avgOverallScore: 0,
          topPages: [],
          slowPages: [],
        },
        deviceBreakdown: [],
      });
    }

    // Calculate top and slow pages
    const pagesWithScores = pages.map(page => ({
      pagePath: page.pagePath,
      lcpP75: Number(page.avgLcpP75),
      fidP75: Number(page.avgFidP75),
      clsP75: Number(page.avgClsP75),
      fcpP75: Number(page.avgFcpP75),
      ttfbP75: Number(page.avgTtfbP75),
      sampleCount: page.totalSamples,
      overallScore: calculateOverallScore({
        lcp: Number(page.avgLcpP75),
        fid: Number(page.avgFidP75),
        cls: Number(page.avgClsP75),
        fcp: Number(page.avgFcpP75),
        ttfb: Number(page.avgTtfbP75),
      }),
    }));

    const topPages = pagesWithScores
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, 10);

    const slowPages = pagesWithScores
      .sort((a, b) => a.overallScore - b.overallScore)
      .slice(0, 10);

    const responseSummary: PerformanceSummary = {
      totalPages: summary.totalPages,
      totalSamples: summary.totalSamples,
      dateRange: {
        start: startDate || '',
        end: endDate || '',
      },
      overallLcp: createPercentileMetric(Number(summary.avgLcpP75), 'LCP'),
      overallFid: createPercentileMetric(Number(summary.avgFidP75), 'FID'),
      overallCls: createPercentileMetric(Number(summary.avgClsP75), 'CLS'),
      overallFcp: createPercentileMetric(Number(summary.avgFcpP75), 'FCP'),
      overallTtfb: createPercentileMetric(Number(summary.avgTtfbP75), 'TTFB'),
      pagesPassingCoreWebVitals: calculatePassingRate([
        Number(summary.avgLcpGoodRate),
        Number(summary.avgFidGoodRate),
        Number(summary.avgClsGoodRate),
      ]),
      avgOverallScore: calculateOverallScore({
        lcp: Number(summary.avgLcpP75),
        fid: Number(summary.avgFidP75),
        cls: Number(summary.avgClsP75),
        fcp: Number(summary.avgFcpP75),
        ttfb: Number(summary.avgTtfbP75),
      }),
      topPages,
      slowPages,
    };

    return NextResponse.json({
      summary: responseSummary,
      deviceBreakdown: deviceBreakdown.map(device => ({
        deviceType: device.deviceType,
        sampleCount: device.totalSamples,
        lcp: createPercentileMetric(Number(device.avgLcpP75), 'LCP'),
        fid: createPercentileMetric(Number(device.avgFidP75), 'FID'),
        cls: createPercentileMetric(Number(device.avgClsP75), 'CLS'),
        overallScore: calculateOverallScore({
          lcp: Number(device.avgLcpP75),
          fid: Number(device.avgFidP75),
          cls: Number(device.avgClsP75),
          fcp: Number(device.avgFcpP75),
          ttfb: Number(device.avgTtfbP75),
        }),
      })),
    });

  } catch (error) {
    console.error('[API] Error fetching performance stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance stats' },
      { status: 500 }
    );
  }
}

// Helper functions
function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function createPercentileMetric(
  p75Value: number,
  metric: 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB' | 'INP'
): PercentileMetric {
  return {
    p50: p75Value * 0.8, // Approximate p50 from p75
    p75: p75Value,
    p95: p75Value * 1.3, // Approximate p95 from p75
    score: getWebVitalScore(metric, p75Value),
  };
}

function calculatePassingRate(goodRates: number[]): number {
  if (goodRates.length === 0) return 0;
  return average(goodRates);
}
