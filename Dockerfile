FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json backend/package.json
COPY frontend/package*.json frontend/package.json
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/data ./backend/data
COPY --from=build /app/backend/db ./backend/db
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/frontend/dist ./frontend/dist
EXPOSE 4000
CMD ["node", "backend/dist/index.js"]
