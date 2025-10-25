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
# Apply SQL Functions
# =====================================================
echo "🔧 Applying database functions..."

# Extract database credentials from DATABASE_URL
# Format: postgresql://user:pass@host:port/dbname
DB_USER=$(echo $DATABASE_URL | sed -n 's/postgresql:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's/postgresql:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Default values if extraction fails
DB_USER=${DB_USER:-pacagen}
DB_NAME=${DB_NAME:-pacagen_hub_prod}

# Set password for psql (avoid password prompt)
export PGPASSWORD="$DB_PASS"

echo "📍 Applying functions to database: $DB_NAME as user: $DB_USER"

# Apply all SQL functions from drizzle/functions directory
FUNCTIONS_DIR="./drizzle/functions"

if [ -d "$FUNCTIONS_DIR" ]; then
  FUNCTION_COUNT=0

  for sql_file in "$FUNCTIONS_DIR"/*.sql; do
    if [ -f "$sql_file" ]; then
      FUNCTION_NAME=$(basename "$sql_file")
      echo "  📄 Applying function: $FUNCTION_NAME"

      if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$sql_file" -q; then
        echo "  ✅ $FUNCTION_NAME applied successfully"
        FUNCTION_COUNT=$((FUNCTION_COUNT + 1))
      else
        echo "  ⚠️  Failed to apply $FUNCTION_NAME, but continuing..."
      fi
    fi
  done

  if [ $FUNCTION_COUNT -gt 0 ]; then
    echo "✅ Applied $FUNCTION_COUNT database functions"
  else
    echo "ℹ️  No SQL functions found to apply"
  fi
else
  echo "ℹ️  Functions directory not found, skipping..."
fi

# Clear password from environment
unset PGPASSWORD

# =====================================================
# Start Application
# =====================================================
echo "🎉 Starting Next.js application..."
exec node server.js
