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
RUN npm ci --omit=dev
COPY --from=builder /app/backend/dist ./dist
RUN mkdir -p data
ENV PORT=3001
EXPOSE 3001
CMD ["node", "dist/index.js"]
