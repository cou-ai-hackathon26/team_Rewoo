// GET /api/v1/analyst/graph — fraud relationship graph.
// Nodes: anonymized reports, phone-tail indicators, domains, shared phrases,
//        tactics, candidate/approved patterns.
// Edges carry explanations. Supports category/status/day filters.
// A relationship = supported similarity or association, NOT proof of a
// common perpetrator (enforced in the wording returned to the UI).
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireAnalyst } from "@/lib/api";

export async function GET(req: NextRequest) {
  const { session, response } = await requireAnalyst();
  if (!session) return response;

  const sp = req.nextUrl.searchParams;
  const category = sp.get("category") ?? "all";
  const status = sp.get("status") ?? "all"; // pattern status filter
  const days = Number(sp.get("days") ?? "30");
  const since = new Date(Date.now() - Math.min(Math.max(days, 1), 90) * 24 * 60 * 60 * 1000);

  const [reports, patterns, edges] = await Promise.all([
    db.report.findMany({
      where: {
        submittedAt: { gte: since },
        ...(category !== "all" ? { category } : {}),
      },
      take: 200,
      orderBy: { submittedAt: "desc" },
    }),
    db.fraudPattern.findMany({
      where: status !== "all" ? { status } : {},
    }),
    db.patternEdge.findMany({}),
  ]);

  type GNode = {
    id: string;
    type: "report" | "pattern" | "phone" | "domain" | "phrase";
    label: string;
    status?: string;
    category?: string;
    synthetic?: boolean;
    date?: string;
  };
  type GEdge = { id: string; source: string; target: string; relation: string; explanation: { bn: string; en: string }; weight: string };

  const nodes = new Map<string, GNode>();
  const graphEdges: GEdge[] = [];

  for (const r of reports) {
    nodes.set(`report:${r.id}`, {
      id: `report:${r.id}`,
      type: "report",
      label: r.id,
      status: r.status,
      category: r.category,
      synthetic: r.synthetic,
      date: r.submittedAt.toISOString(),
    });
    const ind = (r.indicators ?? {}) as { phone?: string | null; domain?: string | null; phrases?: string[] };
    if (ind.phone) {
      const nid = `phone:${ind.phone}`;
      if (!nodes.has(nid))
        nodes.set(nid, { id: nid, type: "phone", label: `${ind.phone} (শেষাংশ)`, synthetic: r.synthetic });
      graphEdges.push({
        id: `e-${r.id}-ph`,
        source: `report:${r.id}`,
        target: nid,
        relation: "mentions_phone",
        explanation: {
          bn: "রিপোর্টকৃত বার্তায় এই মোবাইল নম্বরের শেষাংশ পাওয়া গেছে (সাদৃশ্যের নির্দেশক, প্রমাণ নয়)।",
          en: "The reported message contains this phone tail (a similarity indicator, not proof).",
        },
        weight: "moderate",
      });
    }
    if (ind.domain) {
      const nid = `domain:${ind.domain}`;
      if (!nodes.has(nid)) nodes.set(nid, { id: nid, type: "domain", label: ind.domain, synthetic: r.synthetic });
      graphEdges.push({
        id: `e-${r.id}-dom`,
        source: `report:${r.id}`,
        target: nid,
        relation: "mentions_domain",
        explanation: {
          bn: "রিপোর্টকৃত বার্তায় এই ডোমেইন পাওয়া গেছে।",
          en: "The reported message contains this domain.",
        },
        weight: "strong",
      });
    }
    for (const ph of ind.phrases ?? []) {
      const nid = `phrase:${ph}`;
      if (!nodes.has(nid)) nodes.set(nid, { id: nid, type: "phrase", label: ph, synthetic: r.synthetic });
      graphEdges.push({
        id: `e-${r.id}-p-${ph}`,
        source: `report:${r.id}`,
        target: nid,
        relation: "shares_phrase",
        explanation: {
          bn: "বার্তায় এই শব্দ/বাক্যাংশটি রয়েছে।",
          en: "The message contains this word/phrase.",
        },
        weight: "weak",
      });
    }
  }

  const patternIdMap = new Map<string, string>(); // pattern uuid -> code
  for (const p of patterns) {
    patternIdMap.set(p.id, p.code);
    nodes.set(`pattern:${p.code}`, {
      id: `pattern:${p.code}`,
      type: "pattern",
      label: p.code,
      status: p.status,
      category: p.category,
      synthetic: p.synthetic,
      date: p.lastSeen.toISOString(),
    });
  }

  for (const e of edges) {
    // Only include edges whose both endpoints exist in the current node set
    const srcNode = nodes.get(e.sourceKey);
    const tgtNode = nodes.get(e.targetKey);
    if (!srcNode && !nodes.has(e.sourceKey)) {
      // Indicator nodes from pattern edges (indicator:phone:**** / domain:…)
      if (e.sourceKey.startsWith("indicator:phone:")) {
        const tail = e.sourceKey.replace("indicator:phone:", "");
        nodes.set(e.sourceKey, { id: e.sourceKey, type: "phone", label: `${tail} (শেষাংশ)` });
      } else if (e.sourceKey.startsWith("domain:")) {
        const dom = e.sourceKey.replace("domain:", "");
        nodes.set(e.sourceKey, { id: e.sourceKey, type: "domain", label: dom });
      } else if (e.sourceKey.startsWith("report:")) {
        continue; // report filtered out by time/category — skip edge
      }
    }
    if (!nodes.has(e.sourceKey) || !nodes.has(e.targetKey)) continue;
    graphEdges.push({
      id: e.id,
      source: e.sourceKey,
      target: e.targetKey,
      relation: e.relation,
      explanation: (e.explanation ?? {
        bn: "সমর্থক সম্পর্ক (সাদৃশ্য/সংযোগ — প্রমাণ নয়)।",
        en: "Supporting relationship (similarity/association — not proof).",
      }) as { bn: string; en: string },
      weight: e.weight,
    });
  }

  return ok({
    nodes: Array.from(nodes.values()),
    edges: graphEdges,
    disclaimer: {
      bn: "একটি সম্পর্ক মানে সাদৃশ্য বা সংযোগ পাওয়া গেছে — এটি প্রমাণ নয় যে রিপোর্টগুলো একই ব্যক্তির কাছ থেকে এসেছে। অনুমোদিত ছাড়া কোনো তথ্যই বিশ্বস্ত গোয়েন্দা তথ্য নয়।",
      en: "A relationship indicates supported similarity or association — it is NOT proof the reports share a perpetrator. Only approved, non-expired patterns count as trusted intelligence.",
    },
  });
}
