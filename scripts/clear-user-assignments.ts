/**
 * Script to clear all user assignments
 * Usage: tsx scripts/clear-user-assignments.ts
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { userAssignments } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

// Load DATABASE_URL from .env.local
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const databaseUrl = envContent
  .split('\n')
  .find(line => line.startsWith('DATABASE_URL=') && !line.startsWith('#'))
  ?.split('=')[1]
  ?.trim();

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not found in .env.local');
  process.exit(1);
}

const client = postgres(databaseUrl);
const db = drizzle(client);

async function clearUserAssignments() {
  console.log('🗑️  Clearing all user assignments...');

  try {
    // Get count before deletion
    const countBefore = await db.execute(sql`SELECT COUNT(*) as count FROM user_assignments`);
    const totalBefore = Number(countBefore[0]?.count || 0);

    console.log(`📊 Found ${totalBefore} user assignments`);

    if (totalBefore === 0) {
      console.log('✅ No user assignments to delete');
      await client.end();
      process.exit(0);
    }

    // Confirm deletion
    console.log('\n⚠️  WARNING: This will delete ALL user assignments!');
    console.log('Press Ctrl+C to cancel or wait 3 seconds to continue...\n');

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Delete all records
    await db.delete(userAssignments);

    // Verify deletion
    const countAfter = await db.execute(sql`SELECT COUNT(*) as count FROM user_assignments`);
    const totalAfter = Number(countAfter[0]?.count || 0);

    console.log(`✅ Deleted ${totalBefore} user assignments`);
    console.log(`📊 Remaining: ${totalAfter}`);

  } catch (error) {
    console.error('❌ Error clearing user assignments:', error);
    await client.end();
    process.exit(1);
  }

  await client.end();
  process.exit(0);
}

clearUserAssignments();
