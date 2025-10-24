/**
 * Database Admin API - View all tables
 * Access: http://your-server:3000/api/admin/db
 *
 * ⚠️ SECURITY: Add authentication before using in production!
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    // Get all table names
    const tables = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    // Get row counts for each table
    const stats: Record<string, any> = {};

    for (const table of tables.rows) {
      const tableName = table.table_name;

      try {
        const count = await db.execute(
          sql.raw(`SELECT COUNT(*) as count FROM "${tableName}"`)
        );

        const sample = await db.execute(
          sql.raw(`SELECT * FROM "${tableName}" LIMIT 5`)
        );

        stats[tableName] = {
          count: count.rows[0]?.count || 0,
          sample: sample.rows,
        };
      } catch (err) {
        stats[tableName] = {
          error: 'Failed to query table',
        };
      }
    }

    return NextResponse.json({
      tables: tables.rows.map((t) => t.table_name),
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
