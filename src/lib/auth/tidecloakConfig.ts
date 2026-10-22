import { readFileSync } from "fs";
import { join } from "path";

// Playbook: protect-api-nextjs Step 1
export interface TidecloakConfig {
  realm: string;
  "auth-server-url": string;
  "ssl-required": string;
  resource: string;
  "public-client": boolean;
  "confidential-port": number;
  jwk: { keys: any[] }; // Tide extension: embedded JWKS
  vendorId?: string;
  homeOrkUrl?: string;
}

/**
 * Resolve the TideCloak adapter JSON on the server.
 *
 * Two sources, in order:
 *   1. `CLIENT_ADAPTER` env var — the deployment path. `data/tidecloak.json` is
 *      gitignored (it is environment/licence specific), so a host such as
 *      Vercel has no copy of the file in its build checkout.
 *   2. `data/tidecloak.json` — the local path, written by `npm run init`.
 *
 * Never import this module from a client component: it reads the filesystem.
 * Pass the resolved object down as a prop instead (see `src/app/layout.tsx`).
 */
export function loadTideConfig(): TidecloakConfig {
  const fromEnvironment = process.env.CLIENT_ADAPTER?.trim();
  if (fromEnvironment) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(fromEnvironment);
    } catch {
      throw new Error(
        "CLIENT_ADAPTER is not valid JSON. Paste the adapter JSON exactly as " +
          "exported by TideCloak (providerId=keycloak-oidc-keycloak-json), on one line."
      );
    }
    return validateTideConfig(parsed, "CLIENT_ADAPTER");
  }

  const configPath = join(process.cwd(), "data", "tidecloak.json");
  let raw: string;
  try {
    raw = readFileSync(configPath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        "No TideCloak adapter config found at data/tidecloak.json and CLIENT_ADAPTER is not set. " +
          "Locally, run `npm run init` to export data/tidecloak.json. " +
          "When deploying, set the CLIENT_ADAPTER environment variable to the exported adapter JSON."
      );
    }
    throw error;
  }

  return validateTideConfig(JSON.parse(raw), "data/tidecloak.json");
}

export type TideConfigResult =
  | { config: TidecloakConfig; error: null }
  | { config: null; error: string };

/**
 * Like `loadTideConfig`, but reports a missing/broken config instead of throwing.
 * Used by the root layout so a build or a cold start without config renders an
 * explanatory page rather than crashing with an opaque 500.
 */
export function tryLoadTideConfig(): TideConfigResult {
  try {
    return { config: loadTideConfig(), error: null };
  } catch (error) {
    return {
      config: null,
      error: error instanceof Error ? error.message : "Unknown TideCloak config error",
    };
  }
}

function validateTideConfig(value: unknown, source: string): TidecloakConfig {
  if (typeof value !== "object" || value === null) {
    throw new Error(`TideCloak adapter from ${source} is not a JSON object.`);
  }

  const config = value as TidecloakConfig;
  for (const field of ["realm", "auth-server-url", "resource"] as const) {
    if (typeof config[field] !== "string" || !config[field]) {
      throw new Error(`TideCloak adapter from ${source} is missing "${field}".`);
    }
  }

  if (!config.jwk) {
    throw new Error(
      "Adapter JSON missing jwk field. " +
        "Export via Tide endpoint (providerId=keycloak-oidc-keycloak-json). " +
        "The jwk field is only present when IGA is enabled on the realm."
    );
  }

  return config;
}
