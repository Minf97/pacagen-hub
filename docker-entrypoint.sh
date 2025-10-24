#!/bin/sh
# =====================================================
# Docker Entrypoint Script
# =====================================================
# This script runs when the container starts
# It ensures database is ready and migrations are applied

set -e  # Exit on error

echo "🚀 Starting PacagenHub application..."

# =====================================================
# Wait for PostgreSQL to be ready
# =====================================================
echo "⏳ Waiting for PostgreSQL to be ready..."

# Extract connection details from DATABASE_URL
# Format: postgresql://user:pass@host:port/dbname
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

# Default values if extraction fails
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}

echo "📍 Database host: $DB_HOST:$DB_PORT"

# Wait for database to accept connections (max 30 seconds)
for i in $(seq 1 30); do
  if pg_isready -h "$DB_HOST" -p "$DB_PORT" -q; then
    echo "✅ PostgreSQL is ready!"
    break
  fi

  if [ $i -eq 30 ]; then
    echo "❌ PostgreSQL did not become ready in time"
    exit 1
  fi

  echo "⏳ Waiting for PostgreSQL... ($i/30)"
  sleep 1
done

# =====================================================
# Run Database Migrations
# =====================================================
echo "🔄 Running database migrations..."

# Use npx to ensure drizzle-kit is found
if npx drizzle-kit migrate; then
  echo "✅ Database migrations completed successfully"
else
  echo "⚠️  Database migrations failed, but continuing..."
  # Don't exit - let the app start anyway
  # The app might work without migrations if schema is already up to date
fi

# =====================================================
# Start Application
# =====================================================
echo "🎉 Starting Next.js application..."
exec node server.js
