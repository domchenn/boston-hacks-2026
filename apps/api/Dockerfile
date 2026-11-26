# Container image for the Breadcrumb API (apps/api), for Cloud Run or any Docker host.
# Build from the repo root so the workspace lockfile and packages/contracts are in
# the context:   docker build -f apps/api/Dockerfile -t breadcrumb-api .
# Two stages: compile with dev tools, then ship only the compiled output and
# production dependencies on a distroless Node image (no shell), as a non-root user. Configuration comes
# from environment variables at runtime (see apps/api/.env.example); Cloud Run sets PORT.

FROM node:22-slim AS build
WORKDIR /repo
# Manifests first so dependency installs are cached until they change. Every
# workspace manifest is needed for `npm ci` to match the lockfile.
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w @breadcrumb/api -w @breadcrumb/contracts --no-audit --no-fund
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN npm run build -w @breadcrumb/api

FROM node:22-slim AS prod-deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# Production dependencies only. TypeScript arrives as @nestjs/swagger's optional peer
# (used only by its build-time plugin), so it is removed to keep the image small.
RUN npm ci -w @breadcrumb/api -w @breadcrumb/contracts --omit=dev --no-audit --no-fund \
  && rm -rf node_modules/typescript node_modules/.bin/tsc node_modules/.bin/tsserver

# Distroless: Node.js only, no shell or package manager, runs as a non-root user.
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
ENV NODE_ENV=production PORT=8080
WORKDIR /repo
COPY --from=prod-deps /repo/node_modules node_modules
COPY --from=prod-deps /repo/package.json package.json
COPY --from=prod-deps /repo/packages/contracts/package.json packages/contracts/package.json
COPY --from=prod-deps /repo/apps/api/package.json apps/api/package.json
COPY --from=build /repo/packages/contracts/dist packages/contracts/dist
COPY --from=build /repo/apps/api/dist apps/api/dist
EXPOSE 8080
CMD ["--enable-source-maps", "apps/api/dist/main.js"]
