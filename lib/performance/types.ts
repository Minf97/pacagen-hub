/**
 * Performance Analytics Types
 * Based on Google's Core Web Vitals and Web Performance APIs
 */

// =====================================================
// WEB VITALS SCORING THRESHOLDS
// Based on Google's guidelines: https://web.dev/vitals/
// =====================================================

export const WEB_VITALS_THRESHOLDS = {
  LCP: {
    good: 2500,     // < 2.5s
    needsImprovement: 4000, // 2.5s - 4s
    // > 4s = poor
  },
  FID: {
    good: 100,      // < 100ms
    needsImprovement: 300, // 100ms - 300ms
    // > 300ms = poor
  },
  CLS: {
    good: 0.1,      // < 0.1
    needsImprovement: 0.25, // 0.1 - 0.25
    // > 0.25 = poor
  },
  FCP: {
    good: 1800,     // < 1.8s
    needsImprovement: 3000, // 1.8s - 3s
    // > 3s = poor
  },
  TTFB: {
    good: 800,      // < 800ms
    needsImprovement: 1800, // 800ms - 1.8s
    // > 1.8s = poor
  },
  INP: {
    good: 200,      // < 200ms
    needsImprovement: 500, // 200ms - 500ms
    // > 500ms = poor
  },
} as const;

export type WebVitalScore = 'good' | 'needs-improvement' | 'poor';

// =====================================================
// RAW PERFORMANCE METRIC (from client)
// =====================================================

/**
 * Performance data sent from Hydrogen client
 */
export interface PerformanceMetricPayload {
  // Page identification
  pageUrl: string;
  pagePath: string;
  pageTitle?: string;

  // User context
  sessionId?: string;
  userId?: string;
  userAgent?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  browser?: string;
  country?: string;

  // Core Web Vitals
  lcp?: number;  // Largest Contentful Paint (ms)
  fid?: number;  // First Input Delay (ms)
  cls?: number;  // Cumulative Layout Shift (score, no unit)
  fcp?: number;  // First Contentful Paint (ms)
  ttfb?: number; // Time to First Byte (ms)
  inp?: number;  // Interaction to Next Paint (ms)

  // Navigation Timing
  domContentLoaded?: number; // DOMContentLoaded event (ms)
  windowLoad?: number;       // window.load event (ms)
  domInteractive?: number;   // DOM interactive (ms)
  tti?: number;              // Time to Interactive (ms)

  // Resource metrics
  totalResources?: number;
  totalTransferSize?: number;
  jsExecutionTime?: number;

  // Network info
  connectionType?: string;
  effectiveType?: string;
  referrer?: string;
}

// =====================================================
// PERFORMANCE STATISTICS (aggregated)
// =====================================================

/**
 * Aggregated performance statistics for a page
 */
export interface PagePerformanceStats {
  pagePath: string;
  pageTitle?: string;
  sampleCount: number;

  // Core Web Vitals - percentiles
  lcp: PercentileMetric;
  fid: PercentileMetric;
  cls: PercentileMetric;
  fcp: PercentileMetric;
  ttfb: PercentileMetric;
  inp: PercentileMetric;

  // Navigation timing - averages
  avgDomContentLoaded: number;
  avgWindowLoad: number;
  avgDomInteractive: number;

  // Web Vitals passing rates (% with "good" scores)
  lcpGoodRate: number;  // % with LCP < 2.5s
  fidGoodRate: number;  // % with FID < 100ms
  clsGoodRate: number;  // % with CLS < 0.1

  // Overall score (0-100)
  overallScore: number;
}

export interface PercentileMetric {
  p50: number;  // Median
  p75: number;  // 75th percentile
  p95: number;  // 95th percentile (worst performers)
  score: WebVitalScore; // Based on p75
}

// =====================================================
// PERFORMANCE SUMMARY (for dashboard)
// =====================================================

/**
 * Global performance summary across all pages
 */
export interface PerformanceSummary {
  totalPages: number;
  totalSamples: number;
  dateRange: {
    start: string;
    end: string;
  };

  // Overall Web Vitals scores (based on p75 of all pages)
  overallLcp: PercentileMetric;
  overallFid: PercentileMetric;
  overallCls: PercentileMetric;
  overallFcp: PercentileMetric;
  overallTtfb: PercentileMetric;

  // Passing rates
  pagesPassingCoreWebVitals: number; // % of pages with all good scores
  avgOverallScore: number;           // Average score across all pages

  // Top/Bottom performers
  topPages: PagePerformanceRanking[];
  slowPages: PagePerformanceRanking[];
}

export interface PagePerformanceRanking {
  pagePath: string;
  pageTitle?: string;
  overallScore: number;
  lcpP75: number;
  fidP75: number;
  clsP75: number;
  sampleCount: number;
}

// =====================================================
// TIME SERIES DATA (for trend charts)
// =====================================================

/**
 * Performance metrics over time
 */
export interface PerformanceTimeSeriesPoint {
  date: string; // ISO date (YYYY-MM-DD)
  pagePath: string;

  // P75 values for each metric
  lcpP75: number;
  fidP75: number;
  clsP75: number;
  fcpP75: number;
  ttfbP75: number;

  sampleCount: number;
}

// =====================================================
// DEVICE/BROWSER BREAKDOWN
// =====================================================

/**
 * Performance segmented by device type
 */
export interface DevicePerformanceBreakdown {
  deviceType: 'desktop' | 'mobile' | 'tablet';
  sampleCount: number;

  lcp: PercentileMetric;
  fid: PercentileMetric;
  cls: PercentileMetric;

  overallScore: number;
}

/**
 * Performance segmented by browser
 */
export interface BrowserPerformanceBreakdown {
  browser: string;
  sampleCount: number;

  lcp: PercentileMetric;
  fid: PercentileMetric;
  cls: PercentileMetric;

  overallScore: number;
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Get Web Vital score based on value and thresholds
 */
export function getWebVitalScore(
  metric: 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB' | 'INP',
  value: number
): WebVitalScore {
  const thresholds = WEB_VITALS_THRESHOLDS[metric];

  if (value <= thresholds.good) {
    return 'good';
  } else if (value <= thresholds.needsImprovement) {
    return 'needs-improvement';
  } else {
    return 'poor';
  }
}

/**
 * Calculate overall performance score (0-100)
 * Based on weighted average of Core Web Vitals
 *
 * Weights:
 * - LCP: 25%
 * - FID: 25%
 * - CLS: 25%
 * - FCP: 15%
 * - TTFB: 10%
 */
export function calculateOverallScore(stats: {
  lcp: number;
  fid: number;
  cls: number;
  fcp: number;
  ttfb: number;
}): number {
  // Convert each metric to 0-100 score
  const lcpScore = getMetricScore('LCP', stats.lcp);
  const fidScore = getMetricScore('FID', stats.fid);
  const clsScore = getMetricScore('CLS', stats.cls);
  const fcpScore = getMetricScore('FCP', stats.fcp);
  const ttfbScore = getMetricScore('TTFB', stats.ttfb);

  // Weighted average
  const overallScore =
    lcpScore * 0.25 +
    fidScore * 0.25 +
    clsScore * 0.25 +
    fcpScore * 0.15 +
    ttfbScore * 0.1;

  return Math.round(overallScore);
}

/**
 * Convert metric value to 0-100 score
 */
function getMetricScore(
  metric: 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB' | 'INP',
  value: number
): number {
  const thresholds = WEB_VITALS_THRESHOLDS[metric];
  const score = getWebVitalScore(metric, value);

  if (score === 'good') {
    // Linear interpolation from 100 (perfect) to 75 (good threshold)
    const ratio = value / thresholds.good;
    return Math.max(75, 100 - ratio * 25);
  } else if (score === 'needs-improvement') {
    // Linear interpolation from 75 to 50
    const ratio = (value - thresholds.good) / (thresholds.needsImprovement - thresholds.good);
    return Math.max(50, 75 - ratio * 25);
  } else {
    // Poor: score decreases from 50 towards 0
    const ratio = (value - thresholds.needsImprovement) / thresholds.needsImprovement;
    return Math.max(0, 50 - ratio * 50);
  }
}

/**
 * Format milliseconds to human-readable string
 */
export function formatMs(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  } else {
    return `${(ms / 1000).toFixed(2)}s`;
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
}

/**
 * Get color class for Web Vital score
 */
export function getScoreColor(score: WebVitalScore): string {
  switch (score) {
    case 'good':
      return 'text-green-600';
    case 'needs-improvement':
      return 'text-yellow-600';
    case 'poor':
      return 'text-red-600';
  }
}

/**
 * Get background color class for Web Vital score
 */
export function getScoreBgColor(score: WebVitalScore): string {
  switch (score) {
    case 'good':
      return 'bg-green-50 border-green-200';
    case 'needs-improvement':
      return 'bg-yellow-50 border-yellow-200';
    case 'poor':
      return 'bg-red-50 border-red-200';
  }
}
