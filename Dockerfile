# syntax=docker/dockerfile:1
FROM node:20-alpine

# Create non-root user for security
RUN addgroup -g 1001 -S botgroup && \
    adduser -S botuser -u 1001 -G botgroup

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Set ownership to non-root user
RUN chown -R botuser:botgroup /app

# Switch to non-root user
USER botuser

# No exposed ports - bot only makes outbound connections to Discord
# EXPOSE is intentionally omitted for security

CMD ["node", "main.js"]
