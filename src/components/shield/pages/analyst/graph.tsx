"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  type Node,
  type Edge,
  type NodeProps,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Network,
  Loader2,
  RotateCcw,
  FileWarning,
  GitBranch,
  Phone,
  Globe,
  Quote,
  ShieldCheck,
  X,
  Table,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "../../api";
import { useLang } from "../../i18n";
import { StatusBadge, SyntheticTag } from "../../ui-bits";
import { cn } from "@/lib/utils";

interface GNode {
  id: string;
  type: "report" | "pattern" | "phone" | "domain" | "phrase";
  label: string;
  status?: string;
  category?: string;
  synthetic?: boolean;
  date?: string;
}
interface GEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  explanation: { bn: string; en: string };
  weight: string;
}

const NODE_STYLE: Record<GNode["type"], { bg: string; border: string; icon: React.ReactNode }> = {
  report: { bg: "#FFFEFA", border: "#2F5746", icon: <FileWarning className="h-3.5 w-3.5" style={{ color: "#2F5746" }} aria-hidden /> },
  pattern: { bg: "#2F5746", border: "#2F5746", icon: <GitBranch className="h-3.5 w-3.5" style={{ color: "#DDE8DF" }} aria-hidden /> },
  phone: { bg: "#F2E8D5", border: "#8A5B28", icon: <Phone className="h-3.5 w-3.5" style={{ color: "#8A5B28" }} aria-hidden /> },
  domain: { bg: "#F4E1DA", border: "#A44435", icon: <Globe className="h-3.5 w-3.5" style={{ color: "#A44435" }} aria-hidden /> },
  phrase: { bg: "#DDE8DF", border: "#7D9C8B", icon: <Quote className="h-3.5 w-3.5" style={{ color: "#2F5746" }} aria-hidden /> },
};

function CustomNode({ data }: NodeProps) {
  const d = data as unknown as { gType: GNode["type"]; label: string; status?: string; synthetic?: boolean };
  const style = NODE_STYLE[d.gType] ?? NODE_STYLE.report;
  return (
    <div
      className="px-3 py-2 rounded-xl border-2 shadow-sm flex items-center gap-1.5 max-w-44"
      style={{ background: style.bg, borderColor: style.border }}
    >
      {/* Default (id-less) handles are REQUIRED so edges without explicit
          sourceHandle/targetHandle can attach. Kept invisible: view-only graph. */}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        className="!bg-[#2F5746] !border-0 !w-2 !h-2 !opacity-0"
      />
      {style.icon}
      <span
        className={cn("text-[11px] font-bold truncate", d.gType === "pattern" ? "text-[#DDE8DF]" : "text-[#202C26]")}
        title={d.label}
      >
        {d.label}
      </span>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        className="!bg-[#2F5746] !border-0 !w-2 !h-2 !opacity-0"
      />
    </div>
  );
}

const nodeTypes = { shieldNode: CustomNode };

export default function AnalystGraph() {
  const bn = useLang() === "bn";
  const [rawNodes, setRawNodes] = useState<GNode[] | null>(null);
  const [rawEdges, setRawEdges] = useState<GEdge[]>([]);
  const [disclaimer, setDisclaimer] = useState<{ bn: string; en: string } | null>(null);
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [days, setDays] = useState("30");
  const [selected, setSelected] = useState<GNode | null>(null);
  const [selectedEdges, setSelectedEdges] = useState<GEdge[]>([]);
  const [view, setView] = useState<"graph" | "table">("graph");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    api
      .get<{ nodes: GNode[]; edges: GEdge[]; disclaimer: { bn: string; en: string } }>(
        `/api/v1/analyst/graph?category=${category}&status=${status}&days=${days}`
      )
      .then((d) => {
        setRawNodes(d.nodes);
        setRawEdges(d.edges);
        setDisclaimer(d.disclaimer);
      })
      .catch(() => setRawNodes([]));
  }, [category, status, days]);

  // layout: circle clusters per type, patterns at center
  useEffect(() => {
    if (!rawNodes) return;
    const groups: Record<string, GNode[]> = { pattern: [], report: [], phone: [], domain: [], phrase: [] };
    for (const n of rawNodes) groups[n.type]?.push(n);

    const positions = new Map<string, { x: number; y: number }>();
    const place = (list: GNode[], radius: number, phase: number, spread: number) => {
      list.forEach((n, i) => {
        const angle = phase + (i / Math.max(1, list.length)) * Math.PI * 2 * spread;
        positions.set(n.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
      });
    };
    place(groups.pattern, 0, 0, 1);
    place(groups.report, 260, 0.2, 1);
    place(groups.phone, 520, 1.1, 1);
    place(groups.domain, 520, 2.6, 1);
    place(groups.phrase, 560, 4.4, 1);

    const flowNodes: Node[] = rawNodes.map((n) => ({
      id: n.id,
      type: "shieldNode",
      position: positions.get(n.id) ?? { x: 0, y: 0 },
      data: { gType: n.type, label: n.label, status: n.status, synthetic: n.synthetic } as unknown as Record<string, unknown>,
    }));
    const flowEdges: Edge[] = rawEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      animated: false,
      style: {
        stroke: e.weight === "strong" ? "#2F5746" : e.weight === "moderate" ? "#8A5B28" : "#A9BBA9",
        strokeWidth: e.weight === "strong" ? 2.2 : 1.4,
        strokeDasharray: e.weight === "weak" ? "4 4" : undefined,
      },
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "#A9BBA9" },
    }));
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [rawNodes, rawEdges, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const gnode = rawNodes?.find((n) => n.id === node.id) ?? null;
      setSelected(gnode);
      setSelectedEdges(
        gnode ? rawEdges.filter((e) => e.source === gnode.id || e.target === gnode.id) : []
      );
    },
    [rawNodes, rawEdges]
  );

  const tableRows = useMemo(() => {
    if (!rawNodes) return [];
    return rawNodes
      .filter((n) => n.type === "report" || n.type === "pattern")
      .map((n) => ({
        node: n,
        relations: rawEdges.filter((e) => e.source === n.id || e.target === n.id),
      }));
  }, [rawNodes, rawEdges]);

  const reset = () => {
    setSelected(null);
    setSelectedEdges([]);
    setNodes((nds) =>
      nds.map((n) => {
        const g = rawNodes?.find((r) => r.id === n.id);
        return n;
      })
    );
  };

  if (rawNodes === null) {
    return (
      <div className="flex items-center justify-center py-20 text-[#59665F]" role="status">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-[#2F5746]" aria-hidden />
          <h1 className="text-lg font-bold text-[#202C26] bn-text">
            {bn ? "প্রতারণা সম্পর্ক-গ্রাফ" : "Fraud relationship graph"}
          </h1>
          {rawNodes.length > 0 && rawNodes.some((n) => n.synthetic) && <SyntheticTag />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40 bg-[#FFFEFA] border-[#D8DED5] text-sm h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#FFFEFA] border-[#D8DED5]">
              <SelectItem value="all">{bn ? "সব শ্রেণি" : "All categories"}</SelectItem>
              {Array.from(new Set(rawNodes.filter((n) => n.category).map((n) => n.category!))).map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40 bg-[#FFFEFA] border-[#D8DED5] text-sm h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#FFFEFA] border-[#D8DED5]">
              <SelectItem value="all">{bn ? "সব প্যাটার্ন-অবস্থা" : "All pattern statuses"}</SelectItem>
              <SelectItem value="approved">{bn ? "অনুমোদিত" : "Approved"}</SelectItem>
              <SelectItem value="candidate">{bn ? "প্রার্থী" : "Candidate"}</SelectItem>
              <SelectItem value="rejected">{bn ? "বাতিল" : "Rejected"}</SelectItem>
              <SelectItem value="withdrawn">{bn ? "প্রত্যাহৃত" : "Withdrawn"}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-28 bg-[#FFFEFA] border-[#D8DED5] text-sm h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#FFFEFA] border-[#D8DED5]">
              <SelectItem value="7">{bn ? "৭ দিন" : "7 days"}</SelectItem>
              <SelectItem value="30">{bn ? "৩০ দিন" : "30 days"}</SelectItem>
              <SelectItem value="90">{bn ? "৯০ দিন" : "90 days"}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => { setSelected(null); setSelectedEdges([]); }} className="border-[#D8DED5] text-[#59665F] gap-1.5">
            <RotateCcw className="h-4 w-4" aria-hidden /> {bn ? "রিসেট" : "Reset"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setView(view === "graph" ? "table" : "graph")} className="border-[#D8DED5] text-[#59665F] gap-1.5" aria-pressed={view === "table"}>
            {view === "graph" ? <Table className="h-4 w-4" aria-hidden /> : <LayoutGrid className="h-4 w-4" aria-hidden />}
            {view === "graph" ? (bn ? "টেবিল" : "Table") : bn ? "গ্রাফ" : "Graph"}
          </Button>
        </div>
      </div>

      <p className="text-xs text-[#59665F] leading-relaxed bn-text">
        {disclaimer?.[bn ? "bn" : "en"]}
      </p>

      {view === "graph" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card className="border-[#D8DED5] bg-[#FFFEFA] overflow-hidden">
            <div className="h-[560px] relative">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.15}
                maxZoom={2.2}
                // Attribution kept visible — hiding it requires a React Flow Pro subscription.
              >
                <Background color="#E5E0D5" gap={22} />
                <Controls showInteractive={false} />
                <MiniMap
                  pannable
                  zoomable
                  style={{ background: "#F4F1EB", border: "1px solid #D8DED5", borderRadius: 10 }}
                  nodeColor={(n) => {
                    const g = (n.data as { gType?: string }).gType;
                    if (g === "pattern") return "#2F5746";
                    if (g === "phone") return "#8A5B28";
                    if (g === "domain") return "#A44435";
                    if (g === "phrase") return "#7D9C8B";
                    return "#FFFEFA";
                  }}
                />
              </ReactFlow>
              {/* legend */}
              <div className="absolute left-3 bottom-3 rounded-lg border border-[#D8DED5] bg-[#FFFEFA]/95 px-3 py-2 text-[10px] leading-relaxed shadow-sm">
                <p className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#2F5746]" /> {bn ? "প্যাটার্ন" : "Pattern"}</p>
                <p className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#FFFEFA] border border-[#2F5746]" /> {bn ? "রিপোর্ট" : "Report"}</p>
                <p className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#8A5B28]" /> {bn ? "ফোন-শেষাংশ" : "Phone tail"}</p>
                <p className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#A44435]" /> {bn ? "ডোমেইন" : "Domain"}</p>
                <p className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#7D9C8B]" /> {bn ? "বাক্যাংশ" : "Phrase"}</p>
              </div>
            </div>
          </Card>

          {/* side panel */}
          <Card className="border-[#D8DED5] bg-[#FFFEFA] h-fit lg:sticky lg:top-24">
            <CardContent className="p-5">
              {selected ? (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[#59665F]">
                        {selected.type === "report" ? (bn ? "রিপোর্ট" : "Report")
                        : selected.type === "pattern" ? (bn ? "প্যাটার্ন" : "Pattern")
                        : selected.type === "phone" ? (bn ? "ফোন-শেষাংশ" : "Phone tail")
                        : selected.type === "domain" ? (bn ? "ডোমেইন" : "Domain")
                        : bn ? "বাক্যাংশ" : "Phrase"}
                      </p>
                      <p className="font-bold text-[#202C26] break-all">{selected.label}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-[#59665F]" onClick={() => setSelected(null)} aria-label={bn ? "বন্ধ" : "Close"}>
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                  {selected.status && (
                    <p>
                      <StatusBadge status={selected.status} />
                      {selected.synthetic && <span className="ml-2"><SyntheticTag /></span>}
                    </p>
                  )}
                  {selected.category && <p className="text-sm text-[#59665F]">{selected.category}</p>}
                  {selected.date && (
                    <p className="text-xs text-[#7D9C8B]">
                      {new Date(selected.date).toLocaleDateString(bn ? "bn-BD" : "en-GB")}
                    </p>
                  )}
                  <div>
                    <p className="mb-2 text-sm font-bold text-[#202C26] bn-text">
                      {bn ? "সম্পর্কসমূহ (প্রমাণসহ ব্যাখ্যা)" : "Relationships (evidence-backed)"}
                    </p>
                    <div className="space-y-2 max-h-72 overflow-y-auto scroll-soft pr-1">
                      {selectedEdges.map((e) => (
                        <div key={e.id} className="rounded-lg border border-[#D8DED5] bg-[#F4F1EB]/60 p-3">
                          <p className="text-xs font-bold text-[#2F5746]">{e.relation}</p>
                          <p className="mt-1 text-xs text-[#59665F] leading-relaxed bn-text">
                            {e.explanation[bn ? "bn" : "en"]}
                          </p>
                        </div>
                      ))}
                      {selectedEdges.length === 0 && (
                        <p className="text-xs text-[#59665F] bn-text">{bn ? "কোনো সম্পর্ক নেই।" : "No relationships."}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <ShieldCheck className="mx-auto h-8 w-8 text-[#7D9C8B]" aria-hidden />
                  <p className="mt-2 text-sm text-[#59665F] bn-text">
                    {bn
                      ? "যেকোনো নোডে ক্লিক করুন — সম্পর্ক ও ব্যাখ্যা এখানে দেখা যাবে।"
                      : "Click any node to inspect its relationships and explanations here."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* accessible table alternative */
        <Card className="border-[#D8DED5] bg-[#FFFEFA]">
          <CardContent className="p-0">
            <div className="overflow-x-auto scroll-soft">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#D8DED5] text-left text-[#59665F]">
                    <th className="px-4 py-3 font-bold">{bn ? "সত্তা" : "Entity"}</th>
                    <th className="px-4 py-3 font-bold">{bn ? "ধরন" : "Type"}</th>
                    <th className="px-4 py-3 font-bold">{bn ? "অবস্থা" : "Status"}</th>
                    <th className="px-4 py-3 font-bold">{bn ? "সম্পর্ক সংখ্যা" : "Relations"}</th>
                    <th className="px-4 py-3 font-bold">{bn ? "উৎস" : "Source"}</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map(({ node, relations }) => (
                    <tr key={node.id} className="border-b border-[#EDEAE1] hover:bg-[#F4F1EB]/60">
                      <td className="px-4 py-2.5 font-semibold text-[#202C26] break-all">{node.label}</td>
                      <td className="px-4 py-2.5 text-[#59665F]">{node.type}</td>
                      <td className="px-4 py-2.5">{node.status && <StatusBadge status={node.status} />}</td>
                      <td className="px-4 py-2.5 text-[#59665F] tabular-nums">{relations.length}</td>
                      <td className="px-4 py-2.5">{node.synthetic ? <SyntheticTag /> : <span className="text-xs text-[#2F5746]">citizen</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
