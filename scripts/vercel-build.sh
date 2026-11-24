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
set -eo pipefail

# Ensure node_modules/.bin is in PATH so prisma and next are always found
export PATH="$PWD/node_modules/.bin:$PATH"

DB_URL="${DATABASE_URL:-}"

if [ -n "$DB_URL" ] && [ "${DB_URL#postgres}" != "${DB_URL}" ]; then
  echo "[vercel-build] PostgreSQL DATABASE_URL detected — flipping provider for this build"
  sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
  npx prisma generate
  npx prisma db push --skip-generate || echo "[vercel-build] db push skipped (non-fatal)"
  echo "[vercel-build] provisioning complete — seeding (skips itself if already seeded)"
  if command -v bun >/dev/null 2>&1; then
    bun prisma/seed.ts || echo "[vercel-build] seed failed (non-fatal)"
  else
    npx tsx prisma/seed.ts || echo "[vercel-build] seed failed (non-fatal)"
  fi
else
  echo "[vercel-build] no hosted PostgreSQL — demo mode (embedded /tmp database)"
  mkdir -p db
  export DATABASE_URL="${DB_URL:-file:../db/custom.db}"
  npx prisma generate
  npx prisma db push --skip-generate || echo "[vercel-build] db push failed (non-fatal)"
fi

npx next build
