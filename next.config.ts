import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is only used by the sandbox's custom `bun run start`
  // server. Vercel deploys through its own pipeline and must not receive a
  // standalone bundle, so the option is disabled there (Vercel sets VERCEL=1).
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  // Allow the sandbox preview proxy origin to load dev assets without warnings.
  allowedDevOrigins: ["*.space-z.ai", "*.z.ai"],
  // V7: type errors are fixed, not ignored. Release gates run `tsc --noEmit`
  // (see package.json "typecheck") and the build enforces types again.
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
};

export default nextConfig;
