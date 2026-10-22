"use client";

import { TideCloakProvider } from "@tidecloak/nextjs";
import type { TidecloakConfig } from "@/lib/auth/tidecloakConfig";
import { ProfileOnboarding } from "@/components/ProfileOnboarding";

// Playbook: add-auth-nextjs-fresh Step 4a
// useDPoP goes inside config object (not as a separate JSX prop).
// Enables client-side DPoP proof generation (required for secureFetch).
//
// The adapter JSON is resolved on the server (env var or data/tidecloak.json)
// and passed in as a prop. Do NOT statically import data/tidecloak.json here:
// that file is gitignored, so a clean checkout — Vercel, CI, a new machine —
// has no such module and `next build` fails to resolve it.
export function Providers({
  config,
  children,
}: {
  config: TidecloakConfig;
  children: React.ReactNode;
}) {
  return (
    <TideCloakProvider
      config={{ ...config, useDPoP: { mode: "strict", alg: "ES256" } }}
    >
      {children}
      <ProfileOnboarding
        baseUrl={config["auth-server-url"].replace(/\/+$/, "")}
        realm={config.realm}
      />
    </TideCloakProvider>
  );
}
