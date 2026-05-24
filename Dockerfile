FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./

# Copy workspace package.json files
COPY packages/shared/package.json packages/shared/
COPY packages/tunnel-core/package.json packages/tunnel-core/
COPY apps/relay-server/package.json apps/relay-server/

# Install dependencies
RUN npm ci --workspace=packages/shared --workspace=packages/tunnel-core --workspace=apps/relay-server

# Copy source code
COPY packages/shared/ packages/shared/
COPY packages/tunnel-core/ packages/tunnel-core/
COPY apps/relay-server/ apps/relay-server/

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

ENV PORT=3000
EXPOSE ${PORT}

CMD ["node", "apps/relay-server/dist/index.js"]
