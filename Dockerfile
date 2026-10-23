FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production PORT=3000 BASEERA_DATA_DIR=/app/.runtime-store
WORKDIR /app
RUN apk add --no-cache su-exec
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/.runtime-store && chown -R node:node /app
EXPOSE 3000
# The disk may be mounted over BASEERA_DATA_DIR after image build. Prepare its
# ownership at container startup, then run the application as the unprivileged node user.
CMD ["/bin/sh", "-c", "mkdir -p \"$BASEERA_DATA_DIR\" && chown -R node:node \"$BASEERA_DATA_DIR\" && exec su-exec node:node node server.js"]
