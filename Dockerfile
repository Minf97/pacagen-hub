# =====================================================
# Multi-stage Dockerfile for Next.js Production
# =====================================================

# =====================================================
# Stage 1: Dependencies
# =====================================================
FROM node:20-alpine AS deps

# Install dependencies only when needed
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci && \
    npm cache clean --force

# =====================================================
# Stage 2: Builder
# =====================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Set build-time environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build Next.js application
# Note: We're not using --turbopack in production build
# Turbopack is for development only
RUN npm run build

# =====================================================
# Stage 3: Runner (Production)
# =====================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install production dependencies
RUN apk add --no-cache \
    postgresql-client \
    curl

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Set environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy built application from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy database files (migrations and schema)
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/lib/db ./lib/db
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts

# Copy package.json for drizzle-kit commands
COPY --from=builder /app/package.json ./package.json

# Install drizzle-kit for migrations (production)
RUN npm install drizzle-kit --production && \
    npm cache clean --force

# Copy entrypoint script
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Change ownership
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Start application using entrypoint script
# Script will: wait for DB → run migrations → start app
CMD ["/usr/local/bin/docker-entrypoint.sh"]
