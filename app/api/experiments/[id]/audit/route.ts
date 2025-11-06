import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { userAssignments, experimentStats, events } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'

/**
 * Data Audit Check Result
 */
interface AuditCheck {
  name: string
  status: 'pass' | 'fail' | 'warning'
  expected: number | string
  actual: number | string
  message: string
  discrepancy?: number
}

interface AuditResponse {
  experimentId: string
  timestamp: string
  overallStatus: 'pass' | 'warning' | 'fail'
  checks: AuditCheck[]
  summary: {
    totalChecks: number
    passed: number
    warnings: number
    failed: number
  }
}

/**
 * GET /api/experiments/[id]/audit
 *
 * Performs comprehensive data integrity checks:
 * 1. Segment totals match overall totals
 * 2. Cross-table data consistency
 * 3. Data completeness metrics
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: experimentId } = await params
    const checks: AuditCheck[] = []

    // =====================================================
    // Check 1: Overall visitor count consistency
    // =====================================================
    const [overallCount] = await db
      .select({
        total: sql<number>`count(distinct ${userAssignments.userId})`
      })
      .from(userAssignments)
      .where(eq(userAssignments.experimentId, experimentId))

    const [statsCount] = await db
      .select({
        maxUniqueUsers: sql<number>`max(${experimentStats.uniqueUsers})`
      })
      .from(experimentStats)
      .where(eq(experimentStats.experimentId, experimentId))

    const totalFromAssignments = overallCount.total
    const totalFromStats = statsCount.maxUniqueUsers || 0

    checks.push({
      name: 'Total Visitors Consistency',
      status: totalFromAssignments === totalFromStats ? 'pass' : 'warning',
      expected: totalFromAssignments,
      actual: totalFromStats,
      message: `user_assignments (${totalFromAssignments}) vs experiment_stats (${totalFromStats})`,
      discrepancy: Math.abs(totalFromAssignments - totalFromStats)
    })

    // =====================================================
    // Check 2: Device segmentation coverage
    // =====================================================
    const [deviceCoverage] = await db
      .select({
        desktop: sql<number>`count(distinct case when ${userAssignments.deviceType} = 'desktop' then ${userAssignments.userId} end)`,
        mobile: sql<number>`count(distinct case when ${userAssignments.deviceType} = 'mobile' then ${userAssignments.userId} end)`,
        tablet: sql<number>`count(distinct case when ${userAssignments.deviceType} = 'tablet' then ${userAssignments.userId} end)`,
        unknown: sql<number>`count(distinct case when ${userAssignments.deviceType} is null then ${userAssignments.userId} end)`,
        total: sql<number>`count(distinct ${userAssignments.userId})`
      })
      .from(userAssignments)
      .where(eq(userAssignments.experimentId, experimentId))

    const deviceTotal = Number(deviceCoverage.desktop) + Number(deviceCoverage.mobile) + Number(deviceCoverage.tablet) + Number(deviceCoverage.unknown)
    const deviceMatch = deviceTotal === deviceCoverage.total
    const deviceCoveragePercent = deviceCoverage.total > 0
      ? ((deviceCoverage.desktop + deviceCoverage.mobile + deviceCoverage.tablet) / deviceCoverage.total * 100).toFixed(1)
      : '0'

    checks.push({
      name: 'Device Segmentation Coverage',
      status: deviceMatch ? 'pass' : 'fail',
      expected: deviceCoverage.total,
      actual: deviceTotal,
      message: `Desktop (${deviceCoverage.desktop}) + Mobile (${deviceCoverage.mobile}) + Tablet (${deviceCoverage.tablet}) + Unknown (${deviceCoverage.unknown}) = ${deviceTotal}. Coverage: ${deviceCoveragePercent}%`,
      discrepancy: Math.abs(deviceCoverage.total - deviceTotal)
    })

    // =====================================================
    // Check 3: New/Returning visitor segmentation
    // =====================================================
    const [visitorTypeCoverage] = await db
      .select({
        newVisitors: sql<number>`count(distinct case when ${userAssignments.isNewVisitor} = true then ${userAssignments.userId} end)`,
        returningVisitors: sql<number>`count(distinct case when ${userAssignments.isNewVisitor} = false then ${userAssignments.userId} end)`,
        unknown: sql<number>`count(distinct case when ${userAssignments.isNewVisitor} is null then ${userAssignments.userId} end)`,
        total: sql<number>`count(distinct ${userAssignments.userId})`
      })
      .from(userAssignments)
      .where(eq(userAssignments.experimentId, experimentId))

    const visitorTypeTotal = Number(visitorTypeCoverage.newVisitors) + Number(visitorTypeCoverage.returningVisitors) + Number(visitorTypeCoverage.unknown)
    const visitorTypeMatch = visitorTypeTotal === Number(visitorTypeCoverage.total)
    const newReturningCoveragePercent = visitorTypeCoverage.total > 0
      ? ((Number(visitorTypeCoverage.newVisitors) + Number(visitorTypeCoverage.returningVisitors)) / Number(visitorTypeCoverage.total) * 100).toFixed(1)
      : '0'

    checks.push({
      name: 'New/Returning Visitor Coverage',
      status: visitorTypeMatch ? 'pass' : 'fail',
      expected: Number(visitorTypeCoverage.total),
      actual: Number(visitorTypeTotal),
      message: `New (${visitorTypeCoverage.newVisitors}) + Returning (${visitorTypeCoverage.returningVisitors}) + Unknown (${visitorTypeCoverage.unknown}) = ${visitorTypeTotal}. Coverage: ${newReturningCoveragePercent}%`,
      discrepancy: Math.abs(Number(visitorTypeCoverage.total) - visitorTypeTotal)
    })

    // =====================================================
    // Check 4: Conversion events consistency
    // =====================================================
    const [conversionFromEvents] = await db
      .select({
        count: sql<number>`count(distinct ${events.id})`
      })
      .from(events)
      .innerJoin(
        userAssignments,
        and(
          eq(events.userId, userAssignments.userId),
          eq(userAssignments.experimentId, experimentId)
        )
      )
      .where(eq(events.eventType, 'conversion'))

    const [conversionFromStats] = await db
      .select({
        sum: sql<number>`sum(${experimentStats.conversions})`
      })
      .from(experimentStats)
      .where(eq(experimentStats.experimentId, experimentId))

    const conversionsFromEvents = conversionFromEvents.count
    const conversionsFromStats = conversionFromStats.sum || 0

    checks.push({
      name: 'Conversion Count Consistency',
      status: conversionsFromEvents === conversionsFromStats ? 'pass' : 'warning',
      expected: conversionsFromEvents,
      actual: conversionsFromStats,
      message: `events table (${conversionsFromEvents}) vs experiment_stats (${conversionsFromStats})`,
      discrepancy: Math.abs(conversionsFromEvents - conversionsFromStats)
    })

    // =====================================================
    // Check 5: Variant assignment balance
    // =====================================================
    const variantDistribution = await db
      .select({
        variantId: userAssignments.variantId,
        count: sql<number>`count(distinct ${userAssignments.userId})`
      })
      .from(userAssignments)
      .where(eq(userAssignments.experimentId, experimentId))
      .groupBy(userAssignments.variantId)

    const totalUsers = variantDistribution.reduce((sum, v) => sum + v.count, 0)
    const expectedPerVariant = totalUsers / variantDistribution.length
    const maxDeviation = Math.max(...variantDistribution.map(v =>
      Math.abs(v.count - expectedPerVariant) / expectedPerVariant * 100
    ))

    checks.push({
      name: 'Variant Assignment Balance',
      status: maxDeviation < 10 ? 'pass' : maxDeviation < 20 ? 'warning' : 'fail',
      expected: `~${expectedPerVariant.toFixed(0)} per variant`,
      actual: variantDistribution.map(v => v.count).join(', '),
      message: `Max deviation from expected: ${maxDeviation.toFixed(1)}%. ${variantDistribution.length} variants total.`
    })

    // =====================================================
    // Calculate overall status
    // =====================================================
    const summary = {
      totalChecks: checks.length,
      passed: checks.filter(c => c.status === 'pass').length,
      warnings: checks.filter(c => c.status === 'warning').length,
      failed: checks.filter(c => c.status === 'fail').length
    }

    const overallStatus: 'pass' | 'warning' | 'fail' =
      summary.failed > 0 ? 'fail' :
      summary.warnings > 0 ? 'warning' :
      'pass'

    const response: AuditResponse = {
      experimentId,
      timestamp: new Date().toISOString(),
      overallStatus,
      checks,
      summary
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error performing data audit:', error)
    return NextResponse.json(
      { error: 'Failed to perform data audit' },
      { status: 500 }
    )
  }
}
