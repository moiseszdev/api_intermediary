FROM node:24-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY migrations ./migrations
COPY sql ./sql

RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3000
CMD ["./node_modules/.bin/tsx", "src/server.ts"]
