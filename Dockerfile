FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files and tsconfig
COPY package.json package-lock.json tsconfig.json ./

# Copy workspace package.json and tsconfig files
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/
COPY packages/tunnel-core/package.json packages/tunnel-core/tsconfig.json packages/tunnel-core/
COPY apps/relay-server/package.json apps/relay-server/tsconfig.json apps/relay-server/

# Install dependencies
RUN npm ci --workspace=packages/shared --workspace=packages/tunnel-core --workspace=apps/relay-server

# Copy source code
COPY packages/shared/src packages/shared/src
COPY packages/tunnel-core/src packages/tunnel-core/src
COPY apps/relay-server/src apps/relay-server/src

# Remove test files (they import vitest which is not installed in production build)
RUN rm -rf packages/shared/src/__tests__ packages/tunnel-core/src/__tests__ apps/relay-server/src/__tests__

# Build
RUN npm run build --workspace=packages/shared --workspace=packages/tunnel-core --workspace=apps/relay-server

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/tunnel-core/package.json packages/tunnel-core/
COPY apps/relay-server/package.json apps/relay-server/

RUN npm ci --workspace=packages/shared --workspace=packages/tunnel-core --workspace=apps/relay-server --omit=dev

COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/tunnel-core/dist packages/tunnel-core/dist
COPY --from=builder /app/apps/relay-server/dist apps/relay-server/dist

ENV RELAY_PORT=3000
EXPOSE 3000

CMD ["node", "apps/relay-server/dist/index.js"]
