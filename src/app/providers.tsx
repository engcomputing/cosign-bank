"use client";

import { TideCloakProvider } from "@tidecloak/nextjs";
import tcConfig from "../../data/tidecloak.json";
import { ProfileOnboarding } from "@/components/ProfileOnboarding";

// Playbook: add-auth-nextjs-fresh Step 4a
// useDPoP goes inside config object (not as a separate JSX prop).
// Enables client-side DPoP proof generation (required for secureFetch).
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TideCloakProvider
      config={{ ...tcConfig, useDPoP: { mode: "strict", alg: "ES256" } }}
    >
      {children}
      <ProfileOnboarding
        baseUrl={tcConfig["auth-server-url"].replace(/\/+$/, "")}
        realm={tcConfig.realm}
      />
    </TideCloakProvider>
  );
}
