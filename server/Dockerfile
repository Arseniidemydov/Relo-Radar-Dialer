FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
# Use --ignore-scripts to avoid potential permission issues during build if any scripts try to access system
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

RUN npm ci --only=production

EXPOSE 3001

CMD ["npm", "start"]
