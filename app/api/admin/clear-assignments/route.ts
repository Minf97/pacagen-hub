import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { userAssignments } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

/**
 * DELETE /api/admin/clear-assignments
 * Clear all user assignments
 *
 * Query params:
 * - confirm: 'yes' (required for safety)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const confirm = searchParams.get('confirm');

    if (confirm !== 'yes') {
      return NextResponse.json(
        { error: 'Please add ?confirm=yes to proceed with deletion' },
        { status: 400 }
      );
    }

    // Get count before deletion
    const [countBefore] = await db.execute(
      sql`SELECT COUNT(*) as count FROM user_assignments`
    );
    const totalBefore = Number((countBefore.rows[0] as any).count);

    console.log(`[Admin] Deleting ${totalBefore} user assignments...`);

    // Delete all records
    await db.delete(userAssignments);

    // Verify deletion
    const [countAfter] = await db.execute(
      sql`SELECT COUNT(*) as count FROM user_assignments`
    );
    const totalAfter = Number((countAfter.rows[0] as any).count);

    return NextResponse.json({
      success: true,
      deleted: totalBefore,
      remaining: totalAfter,
    });

  } catch (error) {
    console.error('[Admin] Error clearing user assignments:', error);
    return NextResponse.json(
      { error: 'Failed to clear user assignments', details: String(error) },
      { status: 500 }
    );
  }
}
