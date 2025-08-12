# --- Estágio 1: Builder ---
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./

RUN npm ci --only=production

COPY dist ./dist

# --- Estágio 2: Runner ---
FROM node:18-alpine

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

# Default port, can be overridden by ENV var
EXPOSE 3000

CMD ["node", "dist/src/application.js"]