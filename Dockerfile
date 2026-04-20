# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat wget
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXTJS_IGNORE_ESLINT_ERRORS=true

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
ARG BACKEND_BASE_URL
ARG NEXT_PUBLIC_BASE_URL
ARG AUTH_COOKIE_NAME
ARG COOKIE_SECURE
ENV BACKEND_BASE_URL=${BACKEND_BASE_URL}
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}
ENV AUTH_COOKIE_NAME=${AUTH_COOKIE_NAME}
ENV COOKIE_SECURE=${COOKIE_SECURE}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ > /dev/null || exit 1

CMD ["node", "server.js"]
