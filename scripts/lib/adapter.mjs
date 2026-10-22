import { spawnSync } from "node:child_process";
// Shared adapter resolution/validation for the operator scripts.
// Mirrors src/lib/auth/tidecloakConfig.ts so the CLIs fail the same way the app
// does, without importing TypeScript.

export const ADAPTER_ENV_KEYS = ["CLIENT_ADAPTER", "TIDECLOAK_ADAPTER", "CLIENT_ADAPTER_B64"];
export const REQUIRED_FIELDS = ["realm", "auth-server-url", "resource"];
export const LOCAL_ADAPTER_PATH = ["data", "tidecloak.json"];

export function isLoopbackUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) || host.endsWith(".localhost");
  } catch {
    return false;
  }
}

export function isHttpUrl(value) {
  try {
    return new URL(value).protocol === "http:";
  } catch {
    return false;
  }
}

function parseValue(raw, key) {
  const value = raw.trim();
  if (key.endsWith("_B64")) return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
  if (!value.startsWith("{")) {
    const decoded = Buffer.from(value, "base64").toString("utf8").trim();
    if (decoded.startsWith("{")) return JSON.parse(decoded);
  }
  return JSON.parse(value);
}

/**
 * @returns {{adapter: object, source: string} | null}
 * Throws when a source is present but unusable, so callers stop early.
 */
export function readAdapter({ fs, cwd, path }) {
  for (const key of ADAPTER_ENV_KEYS) {
    const raw = process.env[key];
    if (raw === undefined) continue;
    if (!raw.trim()) throw new Error(`${key} is set but empty.`);
    try {
      return { adapter: parseValue(raw, key), source: key };
    } catch {
      throw new Error(
        `${key} is not valid adapter JSON. Compact it with \`jq -c . data/tidecloak.json\`, ` +
          "or set CLIENT_ADAPTER_B64 instead.",
      );
    }
  }

  const file = path.join(cwd, ...LOCAL_ADAPTER_PATH);
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
  try {
    return { adapter: JSON.parse(raw), source: "data/tidecloak.json" };
  } catch {
    throw new Error("data/tidecloak.json is not valid JSON. Re-export it with `npm run init`.");
  }
}

export function validateAdapter(adapter, source) {
  if (typeof adapter !== "object" || adapter === null) {
    throw new Error(`Adapter from ${source} is not a JSON object.`);
  }
  for (const field of REQUIRED_FIELDS) {
    if (typeof adapter[field] !== "string" || !adapter[field]) {
      throw new Error(`Adapter from ${source} is missing "${field}".`);
    }
  }
  if (!adapter.jwk) {
    throw new Error(
      `Adapter from ${source} is missing jwk — re-export with IGA enabled ` +
        "(providerId=keycloak-oidc-keycloak-json).",
    );
  }
  return adapter;
}

export function issuerFor(adapter) {
  return `${adapter["auth-server-url"].replace(/\/+$/, "")}/realms/${adapter.realm}`;
}

export function adapterBase64(adapter) {
  return Buffer.from(JSON.stringify(adapter), "utf8").toString("base64");
}

export const colors = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

/**
 * Prefer a locally installed Vercel CLI (`npm i -g vercel`); fall back to npx.
 * Returns [command, ...leadingArgs] so callers can spread it.
 */
export function vercelCommand({ execPath = "vercel", which = "vercel" } = {}) {
  const found = spawnSync(which, ["--version"], { encoding: "utf8" });
  if (found.status === 0) return [execPath];
  return ["npx", "--yes", "vercel"];
}
