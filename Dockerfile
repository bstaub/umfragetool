# Multi-Stage Build für optimiertes Image
FROM node:18-alpine AS builder

WORKDIR /app

# Dependencies kopieren und installieren
COPY package*.json ./
RUN npm ci --only=production

# Production Stage
FROM node:18-alpine

WORKDIR /app

# Node-User für Security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Builder Stage von production dependencies kopieren
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Anwendungsdateien kopieren
COPY --chown=nodejs:nodejs . .

# Port exponieren
EXPOSE 3000

# Health Check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# User wechseln
USER nodejs

# Applikation starten
CMD ["npm", "start"]
