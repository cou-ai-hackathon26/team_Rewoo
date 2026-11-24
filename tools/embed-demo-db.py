#!/usr/bin/env python3
"""Re-embed the pristine schema + synthetic-seed SQLite database into
src/lib/serverless-db.ts (see the header comment there).

Usage:
  rm -f prisma/demo-seed.db
  DATABASE_URL="file:./demo-seed.db" bunx prisma db push --skip-generate
  DATABASE_URL="file:../prisma/demo-seed.db" bun prisma/seed.ts
  python3 tools/embed-demo-db.py
"""
import base64
import sqlite3
import os

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

conn = sqlite3.connect("prisma/demo-seed.db")
conn.execute("VACUUM")
conn.close()

data = open("prisma/demo-seed.db", "rb").read()
b64 = base64.b64encode(data).decode()
lines = "\n".join('  "' + b64[i : i + 100] + '",' for i in range(0, len(b64), 100))

src = open("src/lib/serverless-db.ts", encoding="utf-8").read()
start = src.index("const SEEDED_DB_B64 = [")
end = src.index('].join("");', start) + len('].join("");')
src = src[:start] + 'const SEEDED_DB_B64 = [\n' + lines + '\n].join("");' + src[end:]
open("src/lib/serverless-db.ts", "w", encoding="utf-8").write(src)
print(f"embedded {len(data)} bytes ({len(b64)} base64 chars)")
