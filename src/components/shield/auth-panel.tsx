"use client";

// Auth panel — register / sign-in dialog for community membership.
// Minimal-data registration: name + username + password (no phone/email).

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, UserPlus, LogIn, EyeOff, BadgeCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ShieldApiError } from "./api";
import { useLang } from "./i18n";
import { useMember, type MemberInfo } from "./member";

export function AuthDialog({
  open,
  onOpenChange,
  defaultMode = "register",
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultMode?: "register" | "login";
  onDone?: (m: MemberInfo) => void;
}) {
  const bn = useLang() === "bn";
  const setMember = useMember((s) => s.setMember);

  const [mode, setMode] = useState<"register" | "login">(defaultMode);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [newId, setNewId] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setUsername("");
    setPassword("");
    setBusy(false);
    setNewId(null);
  };

  const register = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ member: MemberInfo }>("/api/v1/auth/register", {
        name,
        username,
        password,
      });
      setMember(res.member);
      setNewId(res.member.publicId);
      toast.success(
        bn ? `অ্যাকাউন্ট তৈরি হয়েছে — আপনার আইডি ${res.member.publicId}` : `Account created — your ID is ${res.member.publicId}`
      );
      onDone?.(res.member);
      setTimeout(() => {
        onOpenChange(false);
        reset();
      }, 2200);
    } catch (err) {
      toastError(err, bn);
      setBusy(false);
    }
  };

  const login = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ member: MemberInfo }>("/api/v1/auth/login", {
        username,
        password,
      });
      setMember(res.member);
      toast.success(bn ? `স্বাগতম, ${res.member.name}!` : `Welcome back, ${res.member.name}!`);
      onDone?.(res.member);
      onOpenChange(false);
      reset();
    } catch (err) {
      toastError(err, bn);
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="border-[#D8DED5] bg-[#FFFEFA] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-[#202C26] bn-text">
            <ShieldCheck className="h-5 w-5 text-[#2F5746]" aria-hidden />
            {bn ? "কমিউনিটি সদস্যপদ" : "Community membership"}
          </DialogTitle>
          <DialogDescription className="bn-text">
            {bn
              ? "পোস্ট, মন্তব্য ও সাহায্যের জন্য একটি সদস্য আইডি নিন। ফোন নম্বর বা ইমেইল লাগে না।"
              : "Get a member ID to post, comment and ask for help. No phone number or email needed."}
          </DialogDescription>
        </DialogHeader>

        {newId ? (
          <div className="rounded-2xl border border-[#2F5746]/30 bg-[#DDE8DF]/40 p-6 text-center space-y-2" role="status">
            <BadgeCheck className="mx-auto h-10 w-10 text-[#2F5746]" aria-hidden />
            <p className="font-bold text-[#202C26] bn-text">{bn ? "আপনার ইউনিক আইডি" : "Your unique ID"}</p>
            <p className="text-2xl font-bold tracking-widest text-[#2F5746]">{newId}</p>
            <p className="text-sm text-[#59665F] bn-text">
              {bn ? "এটি লুকিয়ে রাখুন না — এটি আপনার পাবলিক পরিচয়, আসল নামের মতোই।" : "This is your public identity, like a display name — nothing secret."}
            </p>
          </div>
        ) : (
          <Tabs value={mode} onValueChange={(v) => setMode(v as "register" | "login")}>
            <TabsList className="grid h-auto w-full grid-cols-2 bg-[#EDEAE1] p-1.5 rounded-xl">
              <TabsTrigger
                value="register"
                className="rounded-lg py-2.5 text-sm font-semibold data-[state=active]:bg-[#FFFEFA] data-[state=active]:text-[#2F5746] bn-text gap-1.5"
              >
                <UserPlus className="h-4 w-4" aria-hidden />
                {bn ? "নতুন অ্যাকাউন্ট" : "Create account"}
              </TabsTrigger>
              <TabsTrigger
                value="login"
                className="rounded-lg py-2.5 text-sm font-semibold data-[state=active]:bg-[#FFFEFA] data-[state=active]:text-[#2F5746] bn-text gap-1.5"
              >
                <LogIn className="h-4 w-4" aria-hidden />
                {bn ? "সাইন-ইন" : "Sign in"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="register" className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="reg-name" className="text-sm font-semibold text-[#202C26] bn-text">
                  {bn ? "নাম (এই নামেই পোস্ট দেখাবে)" : "Name (shown on your posts)"}
                </Label>
                <Input
                  id="reg-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  placeholder={bn ? "যেমন: সাইমন হাসান" : "e.g. Saimon Hasan"}
                  className="bg-[#FFFEFA] border-[#D8DED5] focus-visible:ring-[#2F5746] h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-username" className="text-sm font-semibold text-[#202C26] bn-text">
                  {bn ? "ইউজারনেম (ইংরেজি ছোট হাতের)" : "Username (lowercase English)"}
                </Label>
                <Input
                  id="reg-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  maxLength={20}
                  placeholder="saimon_dhaka"
                  className="bg-[#FFFEFA] border-[#D8DED5] focus-visible:ring-[#2F5746] h-11"
                  autoCapitalize="none"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-password" className="text-sm font-semibold text-[#202C26] bn-text">
                  {bn ? "পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)" : "Password (at least 8 characters)"}
                </Label>
                <Input
                  id="reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={72}
                  className="bg-[#FFFEFA] border-[#D8DED5] focus-visible:ring-[#2F5746] h-11"
                />
              </div>
              <p className="flex items-start gap-1.5 text-xs text-[#59665F] bn-text">
                <EyeOff className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
                {bn
                  ? "আমরা শুধু নাম, ইউজারনেম ও পাসওয়ার্ড রাখি — ফোন নম্বর, ইমেইল বা ঠিকানা নয়।"
                  : "We store only name, username and password — no phone, email or address."}
              </p>
              <Button
                onClick={register}
                disabled={busy || name.trim().length < 2 || username.length < 3 || password.length < 8}
                className="w-full h-12 bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A] rounded-xl font-bold gap-2"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <UserPlus className="h-5 w-5" aria-hidden />}
                {bn ? "আইডি তৈরি করুন" : "Create my ID"}
              </Button>
            </TabsContent>

            <TabsContent value="login" className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-username" className="text-sm font-semibold text-[#202C26] bn-text">
                  {bn ? "ইউজারনেম" : "Username"}
                </Label>
                <Input
                  id="login-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  maxLength={20}
                  placeholder="saimon_dhaka"
                  className="bg-[#FFFEFA] border-[#D8DED5] focus-visible:ring-[#2F5746] h-11"
                  autoCapitalize="none"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password" className="text-sm font-semibold text-[#202C26] bn-text">
                  {bn ? "পাসওয়ার্ড" : "Password"}
                </Label>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={72}
                  className="bg-[#FFFEFA] border-[#D8DED5] focus-visible:ring-[#2F5746] h-11"
                />
              </div>
              <Button
                onClick={login}
                disabled={busy || username.length < 3 || password.length < 1}
                className="w-full h-12 bg-[#2F5746] text-[#FFFEFA] hover:bg-[#24453A] rounded-xl font-bold gap-2"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <LogIn className="h-5 w-5" aria-hidden />}
                {bn ? "সাইন-ইন" : "Sign in"}
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function toastError(err: unknown, bn: boolean) {
  if (err instanceof ShieldApiError) {
    toast.error(err.apiError.message);
  } else {
    toast.error(bn ? "নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন" : "Network problem — please retry");
  }
}
