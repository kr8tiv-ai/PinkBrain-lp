FROM node:20-slim AS builder
WORKDIR /app
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci
COPY backend/ .
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/backend/package*.json ./
COPY --from=builder /app/backend/node_modules ./node_modules
RUN npm prune --omit=dev
COPY --from=builder /app/backend/dist ./dist
RUN mkdir -p data && chown -R node:node /app
ENV PORT=3001
EXPOSE 3001
USER node
CMD ["node", "dist/index.js"]
