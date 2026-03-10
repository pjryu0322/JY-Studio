# JYWorkspace

JYWorkspace is a browser-based collaboration platform MVP being developed inside the JY-Studio monorepo.

The platform is planned to support:

- Video meeting
- Chat
- Screen sharing
- Document sharing
- Real-time subtitle translation
- Translated voice playback

For the MVP, LiveKit Managed Cloud is the real-time media platform. During early development, the application server will run locally on Windows.

## Workspace Layout

```text
projects/JYWorkspace/
  apps/
    web/
    server/
    translation-worker/
  packages/
    shared/
  docs/
  scripts/
```

## Local Runtime Layout

Use relative runtime paths so the project stays portable between local Windows development and future cloud environments.

```text
runtime/
  storage/
    documents/
    audio/
  temp/
  logs/
```

Recommended local conventions:

- `STORAGE_MODE=local` keeps early development assets on the local machine
- `STORAGE_BASE_PATH=./runtime/storage` stores documents and generated audio under the workspace
- `LOG_DIR=./runtime/logs` keeps application logs inside the project runtime tree
- `DATABASE_URL` should point to the developer's local database instance without hardcoding machine-specific absolute paths

## Package Management

This project uses a `pnpm` workspace rooted at `projects/JYWorkspace`.

## Root Scripts

- `pnpm dev` starts the server, translation worker, and web app together
- `pnpm dev:web` starts the Next.js client
- `pnpm dev:server` starts the API server
- `pnpm dev:worker` starts the translation worker
- `pnpm build` builds all workspace packages
- `pnpm lint` runs TypeScript-based checks across the workspace

## Early Bootstrapped Packages

- `apps/web`: Next.js TypeScript landing page for the MVP shell
- `apps/server`: local Windows-friendly Node.js TypeScript API server with `/api/health`
- `apps/translation-worker`: Node.js TypeScript worker shell for future translation processing
- `packages/shared`: shared types and utilities shell