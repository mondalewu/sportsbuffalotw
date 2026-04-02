FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache ffmpeg gcompat
COPY package*.json ./
RUN npm install

FROM base AS development
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]

FROM base AS builder
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache ffmpeg gcompat
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
