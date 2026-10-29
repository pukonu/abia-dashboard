# syntax=docker/dockerfile:1.7
# Abia Executive Dashboard web image. Built on the Mac by site.yml with webapp/ as context:
#   docker buildx build --platform linux/amd64 -f deploy/ansible/Dockerfile \
#     --secret id=appenv,src=<prod env> .
# The production env is a build secret: Next reads it for NEXT_PUBLIC_* values
# and it never lands in a layer. At runtime the container gets it via env_file.

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# package.json pins yarn@4 (packageManager); yarn.lock already records the
# Linux native binaries (@next/swc, lightningcss, tailwind oxide, sharp).
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
RUN --mount=type=cache,target=/root/.yarn/berry/cache \
    yarn install --immutable

COPY . .
RUN --mount=type=secret,id=appenv,target=/app/.env.production \
    NODE_ENV=production NODE_OPTIONS=--max-old-space-size=4096 yarn build \
 && rm -rf .next/cache

FROM node:22-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=7401
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 7401
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "7401"]
