"use client";

import { useEffect, useState } from "react";
import { Search, Loader2, UserCog, Server, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "../../api";
import { useLang } from "../../i18n";

interface AuditEvent {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

const ACTION_STYLE = (action: string): string => {
  if (action.includes("approve")) return "text-[#2F5746] bg-[#DDE8DF]";
  if (action.includes("reject")) return "text-[#A44435] bg-[#F4E1DA]";
  if (action.includes("withdraw")) return "text-[#59665F] bg-[#EDEAE1]";
  if (action.includes("login") || action.includes("logout")) return "text-[#8A5B28] bg-[#F2E8D5]";
  return "text-[#2F5746] bg-[#DDE8DF]";
};

export default function AnalystAudit() {
  const bn = useLang() === "bn";
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    api
      .get<{ events: AuditEvent[] }>("/api/v1/analyst/audit?limit=200")
      .then((r) => setEvents(r.events))
      .catch(() => setEvents([]));
  }, []);

  const filtered = events?.filter(
    (e) =>
      !q ||
      e.action.toLowerCase().includes(q.toLowerCase()) ||
      (e.entityId ?? "").toLowerCase().includes(q.toLowerCase()) ||
      (e.actorId ?? "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-lg font-bold text-[#202C26]">
          <Search className="h-5 w-5 text-[#2F5746]" aria-hidden />
          {bn ? "অডিট লগ (অপরিবর্তনীয়)" : "Audit log (immutable)"}
        </h1>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#59665F]" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={bn ? "ক্রিয়া / সত্তা খুঁজুন…" : "Search action / entity…"}
            className="pl-8 w-56 h-9 bg-[#FFFEFA] border-[#D8DED5] focus-visible:ring-[#2F5746]"
            aria-label={bn ? "অডিট অনুসন্ধান" : "Search audit"}
          />
        </div>
      </div>
      <p className="text-xs text-[#59665F] bn-text">
        {bn
          ? "প্রতিটি রিভিউ, লগইন ও গুরুত্বপূর্ণ সিস্টেম ঘটনা সার্ভার-সাইডে অডিট ইভেন্ট তৈরি করে — মুছে ফেলা যায় না।"
          : "Every review, sign-in and important system event creates a server-side audit event — they cannot be deleted."}
      </p>

      {events === null ? (
        <div className="flex justify-center py-16" role="status">
          <Loader2 className="h-6 w-6 animate-spin text-[#59665F]" aria-hidden />
        </div>
      ) : (
        <Card className="border-[#D8DED5] bg-[#FFFEFA]">
          <CardContent className="p-0">
            <div className="overflow-x-auto scroll-soft max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#EDEAE1]">
                  <tr className="text-left text-[#59665F]">
                    <th className="px-4 py-2.5 font-bold">{bn ? "সময়" : "Time"}</th>
                    <th className="px-4 py-2.5 font-bold">{bn ? "কর্তা" : "Actor"}</th>
                    <th className="px-4 py-2.5 font-bold">{bn ? "ক্রিয়া" : "Action"}</th>
                    <th className="px-4 py-2.5 font-bold">{bn ? "সত্তা" : "Entity"}</th>
                    <th className="px-4 py-2.5 font-bold">{bn ? "বিস্তারিত" : "Detail"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered?.map((e) => (
                    <tr key={e.id} className="border-t border-[#EDEAE1] hover:bg-[#F4F1EB]/60 align-top">
                      <td className="px-4 py-2 whitespace-nowrap text-xs text-[#59665F]">
                        {new Date(e.createdAt).toLocaleString(bn ? "bn-BD" : "en-GB", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-1 text-xs text-[#59665F]">
                          {e.actorType === "analyst" ? (
                            <UserCog className="h-3.5 w-3.5" aria-hidden />
                          ) : e.actorType === "citizen" ? (
                            <User className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <Server className="h-3.5 w-3.5" aria-hidden />
                          )}
                          {e.actorType}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${ACTION_STYLE(e.action)}`}>
                          {e.action}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-[#59665F] break-all">
                        {e.entityType}
                        {e.entityId ? ` · ${e.entityId}` : ""}
                      </td>
                      <td className="px-4 py-2 text-xs text-[#59665F]">
                        {e.detail ? (
                          <code className="break-all line-clamp-2" style={{ fontFamily: "inherit" }}>
                            {JSON.stringify(e.detail).slice(0, 160)}
                          </code>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered?.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-[#59665F]">
                        {bn ? "কোনো মিল পাওয়া যায়নি।" : "No matches."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
