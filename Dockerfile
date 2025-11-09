# Multi-stage build for production optimization
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files and tsconfig
COPY package*.json tsconfig.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci && npm cache clean --force

# Copy source code and prisma
COPY src ./src
COPY prisma ./prisma

# Build TypeScript (includes prisma generate)
RUN ls -la && cat tsconfig.json && npm run build

# Production stage
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# Create data directory for CSV files
RUN mkdir -p /app/data/backups && chown -R nodejs:nodejs /app/data

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]
