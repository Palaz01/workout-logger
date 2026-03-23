FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/db/package.json lib/db/
COPY lib/api-zod/package.json lib/api-zod/
COPY lib/api-spec/package.json lib/api-spec/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/workout-tracker/package.json artifacts/workout-tracker/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @workspace/workout-tracker run build
RUN pnpm --filter @workspace/api-server run build

FROM base AS production

COPY --from=deps /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=deps /app/lib/db/package.json lib/db/
COPY --from=deps /app/lib/api-zod/package.json lib/api-zod/
COPY --from=deps /app/lib/api-spec/package.json lib/api-spec/
COPY --from=deps /app/lib/api-client-react/package.json lib/api-client-react/
COPY --from=deps /app/artifacts/api-server/package.json artifacts/api-server/
COPY --from=deps /app/artifacts/workout-tracker/package.json artifacts/workout-tracker/
COPY --from=deps /app/node_modules/ node_modules/
COPY --from=deps /app/lib/db/node_modules/ lib/db/node_modules/
COPY --from=deps /app/artifacts/api-server/node_modules/ artifacts/api-server/node_modules/

COPY lib/db/ lib/db/
COPY --from=build /app/artifacts/api-server/dist/ artifacts/api-server/dist/
COPY --from=build /app/artifacts/workout-tracker/dist/public/ artifacts/api-server/dist/public/
COPY start.sh ./
RUN chmod +x start.sh

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["./start.sh"]
