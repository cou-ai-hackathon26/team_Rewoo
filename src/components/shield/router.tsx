"use client";

// Minimal hash router: real URLs after #, back-button support, no dependencies.

import { useCallback, useEffect, useState, type ReactNode, type MouseEvent } from "react";

export interface RouteInfo {
  path: string; // e.g. "/check/voice"
  parts: string[]; // ["check", "voice"]
}

function parseHash(hash: string): RouteInfo {
  const clean = (hash || "").replace(/^#/, "");
  // V3: support hash query strings (#/check/voice?demo=rahela-voice).
  const pathOnly = clean.split("?")[0];
  const path = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  const parts = path.split("/").filter(Boolean);
  return { path, parts };
}

export function useHashRoute(): RouteInfo & { navigate: (to: string, opts?: { replace?: boolean }) => void } {
  const [route, setRoute] = useState<RouteInfo>(() =>
    typeof window === "undefined" ? { path: "/", parts: [] } : parseHash(window.location.hash)
  );

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((to: string, opts?: { replace?: boolean }) => {
    const target = to.startsWith("/") ? to : `/${to}`;
    const url = `#${target}`;
    if (opts?.replace) {
      window.history.replaceState(null, "", url);
      setRoute(parseHash(url));
    } else {
      window.location.hash = target;
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  return { ...route, navigate };
}

export function Link({
  to,
  children,
  className,
  onClick,
  ariaLabel,
  ariaCurrent,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
  ariaCurrent?: boolean;
}) {
  const handle = (e: MouseEvent) => {
    e.preventDefault();
    window.location.hash = to.startsWith("/") ? to : `/${to}`;
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    onClick?.();
  };
  return (
    <a href={`#${to}`} onClick={handle} className={className} aria-label={ariaLabel} aria-current={ariaCurrent ? "page" : undefined}>
      {children}
    </a>
  );
}
