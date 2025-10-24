/**
 * Database Client and Connection Pool
 * Using Drizzle ORM with postgres.js driver
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL environment variable is not set. Please add it to your .env.local file.'
  );
}

// Create postgres.js connection
// This is a connection pool that reuses connections
// During build time, connection will fail but won't break the build
const queryClient = postgres(process.env.DATABASE_URL, {
  max: 10, // Maximum number of connections in the pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
  // In build environment, don't actually connect to avoid errors
  onnotice: () => {}, // Suppress notices during build
});

// Create Drizzle instance with schema
export const db = drizzle(queryClient, { schema });

// Export for type inference
export type Database = typeof db;

// Helper function to close the database connection (for graceful shutdown)
export async function closeDatabase() {
  await queryClient.end();
}
