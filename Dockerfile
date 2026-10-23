FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/.runtime-store && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["npm", "start"]
