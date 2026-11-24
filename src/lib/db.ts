// V8: on serverless (Vercel) deployments the SQLite file cannot ship with the
// bundle — ensureServerlessDatabase() writes the embedded pristine schema +
// synthetic-seed database to /tmp and points DATABASE_URL there BEFORE the
// Prisma client is constructed. No-op locally and whenever a durable (non-
// file:) DATABASE_URL is configured. See src/lib/serverless-db.ts.
import { ensureServerlessDatabase } from "./serverless-db";

ensureServerlessDatabase();

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // No query logging: query logs could echo citizen-submitted (redacted)
    // content into stdout/observability pipelines. Errors still surface.
    log: ["error"],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
