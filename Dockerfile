FROM node:20-bullseye-slim AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:20-bullseye-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN APP_SERVER_MODE=build MONITOR_PROCESS_ENABLED=false npm run build

FROM node:20-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app .
EXPOSE 3000 3001
CMD ["npm", "run", "start:frontend"]
