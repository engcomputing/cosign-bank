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
 * Environment variables that may carry the adapter, in priority order.
 *
 * `CLIENT_ADAPTER_B64` exists because hosting dashboards (Vercel included)
 * often mangle multi-line JSON when pasting into a value field, which turns a
 * correct adapter into "invalid JSON". Base64 is a single line by construction:
 *   base64 -w0 data/tidecloak.json    (macOS: base64 data/tidecloak.json | tr -d '\n')
 */
export const ADAPTER_ENV_KEYS = [
  "CLIENT_ADAPTER",
  "TIDECLOAK_ADAPTER",
  "CLIENT_ADAPTER_B64",
] as const;

/**
 * Resolve the TideCloak adapter JSON on the server.
 *
 * Sources, in order:
 *   1. `CLIENT_ADAPTER` / `TIDECLOAK_ADAPTER` / `CLIENT_ADAPTER_B64` env vars —
 *      the deployment path. `data/tidecloak.json` is gitignored (environment and
 *      licence specific), so a host such as Vercel has no copy in its checkout.
 *   2. `data/tidecloak.json` — the local path, written by `npm run init`.
 *
 * Never import this module from a client component: it reads the filesystem.
 * Pass the resolved object down as a prop instead (see `src/app/layout.tsx`).
 */
export function loadTideConfig(): TidecloakConfig {
  for (const key of ADAPTER_ENV_KEYS) {
    const raw = process.env[key];
    if (raw === undefined) continue;

    const value = raw.trim();
    if (!value) {
      throw new Error(
        `${key} is set but empty in this deployment. Paste the adapter JSON ` +
          "(or its base64 form) as the value, then redeploy: environment variable " +
          "changes only apply to new deployments."
      );
    }

    return validateTideConfig(parseAdapterValue(value, key), key);
  }

  const configPath = join(process.cwd(), "data", "tidecloak.json");
  let rawFile: string;
  try {
    rawFile = readFileSync(configPath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        "No TideCloak adapter config found at data/tidecloak.json and none of " +
          `${ADAPTER_ENV_KEYS.join(", ")} is set. ` +
          "Locally, run `npm run init` to export data/tidecloak.json. " +
          "When deploying, set the CLIENT_ADAPTER environment variable (or " +
          "CLIENT_ADAPTER_B64 for the base64 form) and redeploy — hosted environment " +
          "variables only apply to new deployments."
      );
    }
    throw error;
  }

  return validateTideConfig(JSON.parse(rawFile), "data/tidecloak.json");
}

export type TideConfigResult =
  | { config: TidecloakConfig; error: null; warnings: string[] }
  | { config: null; error: string; warnings: string[] };

/**
 * Like `loadTideConfig`, but reports a missing/broken config instead of throwing.
 * Used by the root layout so a build or a cold start without config renders an
 * explanatory page rather than crashing with an opaque 500.
 */
export function tryLoadTideConfig(hostname?: string | null): TideConfigResult {
  try {
    const config = loadTideConfig();
    // Treat an unknown hostname on a hosting platform as hosted; a local shell
    // with no hostname stays quiet so `npm run dev` shows no false alarms.
    const servedFromLocalhost = hostname
      ? isLoopbackHostname(hostname)
      : !isHostedDeployment();
    return { config, error: null, warnings: tideConfigWarnings(config, { servedFromLocalhost }) };
  } catch (error) {
    return {
      config: null,
      error: error instanceof Error ? error.message : "Unknown TideCloak config error",
      warnings: [],
    };
  }
}

/**
 * True when we are running on a hosting platform rather than a local shell.
 * Used by routes that never see a browser hostname (e.g. /api/config).
 */
export function isHostedDeployment(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.NETLIFY ||
      process.env.CF_PAGES ||
      process.env.RENDER ||
      process.env.FLY_APP_NAME,
  );
}

export function isLoopbackHostname(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  const host = hostname.split(":")[0].replace(/^\[|\]$/g, "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost");
}

/**
 * Non-fatal problems that stop sign-in even though the adapter parsed.
 *
 * The common one: `npm run init` exports an adapter pointing at the local dev
 * container (`http://localhost:8080`). A hosted site loads in someone else's
 * browser, where `localhost` is *their* machine, so the login iframe can never
 * reach the realm. Only report that when the app is genuinely served from a
 * non-local host, so local development stays clean.
 */
export function tideConfigWarnings(
  config: TidecloakConfig,
  options: { servedFromLocalhost: boolean },
): string[] {
  const warnings: string[] = [];
  const authServer = config["auth-server-url"] ?? "";

  if (isLoopbackUrl(authServer) && !options.servedFromLocalhost) {
    warnings.push(
      `The adapter's auth-server-url is ${authServer}, which only resolves on the ` +
        "machine running TideCloak. Browsers visiting this deployment cannot reach it, " +
        "so sign-in will fail. Expose TideCloak on a public HTTPS URL and export a new " +
        "adapter (TIDECLOAK_URL=https://... ./scripts/init-tidecloak.sh), or run the demo locally."
    );
  }

  if (authServer.startsWith("http://") && !isLoopbackUrl(authServer)) {
    warnings.push(
      `The adapter's auth-server-url uses http:// (${authServer}). Browsers block ` +
        "insecure iframes and DPoP flows from an https:// deployment; use an https:// URL."
    );
  }

  return warnings;
}

function isLoopbackUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "[::1]" ||
      host.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

function parseAdapterValue(value: string, source: string): unknown {
  // Accept base64 (env var convention) as well as raw JSON.
  if (source.endsWith("_B64")) {
    let decoded: string;
    try {
      decoded = Buffer.from(value, "base64").toString("utf-8");
    } catch {
      throw new Error(`${source} is not valid base64.`);
    }
    return parseJson(decoded, source);
  }

  if (!value.startsWith("{")) {
    // Tolerate a base64 value in CLIENT_ADAPTER too — a frequent mix-up that
    // otherwise reports a misleading "invalid JSON" error.
    const decoded = Buffer.from(value, "base64").toString("utf-8").trim();
    if (decoded.startsWith("{")) return parseJson(decoded, source);
  }

  return parseJson(value, source);
}

function parseJson(value: string, source: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(
      `${source} is not valid JSON. Paste the adapter JSON exactly as exported by ` +
        "TideCloak (providerId=keycloak-oidc-keycloak-json), compacted with `jq -c .`, " +
        "or use CLIENT_ADAPTER_B64 to avoid multi-line paste problems."
    );
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
