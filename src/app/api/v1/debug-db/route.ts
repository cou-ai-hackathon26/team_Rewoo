// GET /api/v1/debug-db — TEMPORARY serverless database bootstrap diagnostics.
// Returns booleans and non-sensitive fragments only (never env values or
// secrets). Purpose: pinpoint why the /tmp SQLite bootstrap fails on Vercel.
import { NextRequest, NextResponse } from "next/server";
import { existsSync, writeFileSync, statSync, rmSync } from "fs";

export async function GET(_req: NextRequest) {
  const diag: Record<string, unknown> = {};

  try {
    diag.vercelEnv = process.env.VERCEL ?? null; // "1" expected on Vercel
  } catch (e) {
    diag.vercelEnv = `error:${String(e)}`;
  }

  try {
    const url = process.env.DATABASE_URL;
    diag.databaseUrlSet = typeof url === "string" && url.length > 0;
    diag.databaseUrlIsFile = Boolean(url?.startsWith("file:"));
    diag.databaseUrlPrefix = url ? url.slice(0, 5) : null; // "file:" or other — no values
  } catch (e) {
    diag.databaseUrl = `error:${String(e)}`;
  }

  // /tmp writability probe
  try {
    const probe = "/tmp/bs-probe.txt";
    writeFileSync(probe, "ok");
    diag.tmpWritable = existsSync(probe);
    rmSync(probe);
  } catch (e) {
    diag.tmpWritable = `error:${String(e).slice(0, 120)}`;
  }

  // bootstrap target state
  try {
    diag.targetPath = "/tmp/banglashield.db";
    diag.targetExists = existsSync("/tmp/banglashield.db");
    if (diag.targetExists) diag.targetSize = statSync("/tmp/banglashield.db").size;
  } catch (e) {
    diag.target = `error:${String(e).slice(0, 120)}`;
  }

  // direct Prisma query with the CURRENT env (the health path, post-bootstrap)
  try {
    const { PrismaClient } = await import("@prisma/client");
    const db = new PrismaClient();
    const count = await db.report.count();
    diag.prismaQueryOk = true;
    diag.reportCount = count;
    await db.$disconnect();
  } catch (e) {
    diag.prismaQueryOk = false;
    diag.prismaError = String(e).slice(0, 300);
  }

  return NextResponse.json(
    { ok: true, diag, time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
