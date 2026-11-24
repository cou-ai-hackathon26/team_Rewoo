#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Vercel build pipeline (referenced by package.json "vercel-build"; see
# README "Deploying to Vercel"). Two database modes:
#
#   1. Hosted PostgreSQL configured (DATABASE_URL starts with "postgres"):
#      flip the committed schema's provider to "postgresql" for this build,
#      generate the client against it, provision the schema with
#      `prisma db push`, and seed once (idempotent — the seed script skips
#      itself when the analyst account already exists). This is the durable
#      production mode.
#
#   2. Nothing (or a SQLite file: URL) configured: provision the local file
#      database best-effort (non-fatal). The runtime then uses the embedded
#      /tmp bootstrap database (src/lib/serverless-db.ts) — per-instance,
#      clearly documented as the demo mode.
#
# The provider flip happens only inside the ephemeral build container — the
# committed schema keeps provider = "sqlite" so the local/sandbox workflow
# is unchanged.
# ---------------------------------------------------------------------------
set -euo pipefail

if [ "${DATABASE_URL#postgres}" != "${DATABASE_URL}" ]; then
  echo "[vercel-build] PostgreSQL DATABASE_URL detected — flipping provider for this build"
  sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
  prisma generate
  prisma db push --skip-generate
  echo "[vercel-build] provisioning complete — seeding (skips itself if already seeded)"
  bun prisma/seed.ts || echo "[vercel-build] seed failed (non-fatal)"
else
  echo "[vercel-build] no hosted PostgreSQL — demo mode (embedded /tmp database)"
  mkdir -p db
  prisma generate
  DATABASE_URL="${DATABASE_URL:-file:../db/custom.db}" prisma db push --skip-generate \
    || echo "[vercel-build] db push failed (non-fatal)"
fi

next build
