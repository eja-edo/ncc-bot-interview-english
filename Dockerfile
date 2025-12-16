FROM node:20-alpine AS base

WORKDIR /app

FROM base AS dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN yarn build

FROM base AS production
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig*.json ./
COPY --from=build /app/typeorm-cli.ts ./typeorm-cli.ts

EXPOSE 3000

CMD ["node", "dist/main.js"]

