import "server-only";

import { tryLoadTideConfig } from "./tidecloakConfig";

/**
 * How this deployment authenticates.
 *
 *  tidecloak     — a TideCloak adapter resolves: real OIDC, real tokens, real DPoP.
 *  simulated     — no adapter, but the simulator is enabled (the default). Sign-in,
 *                  roles and access checks run against src/lib/auth/demo-identity.ts.
 *  unconfigured  — no adapter and `DEMO_AUTH=0`: authentication is off, protected
 *                  routes answer 503 and the UI shows preview/configuration pages.
 */
export type AuthMode = "tidecloak" | "simulated" | "unconfigured";

export function demoAuthEnabled(): boolean {
  // Opt-out, not opt-in: a deployment with no adapter would otherwise be a dead
  // page. Set DEMO_AUTH=0 to require real TideCloak configuration.
  return process.env.DEMO_AUTH !== "0" && process.env.DEMO_AUTH !== "false";
}

export function authMode(): AuthMode {
  const { config } = tryLoadTideConfig();
  if (config) return "tidecloak";
  return demoAuthEnabled() ? "simulated" : "unconfigured";
}

/** Human-readable explanation for logs, API payloads and the UI banner. */
export function authModeDescription(mode: AuthMode = authMode()): string {
  switch (mode) {
    case "tidecloak":
      return "TideCloak OIDC with server-side JWT and DPoP verification";
    case "simulated":
      return "Simulated TideCloak identity: sign-in, roles and access checks are simulated";
    default:
      return "Authentication is not configured";
  }
}
