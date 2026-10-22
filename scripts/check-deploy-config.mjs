#!/usr/bin/env node
// deploy:check — validate the TideCloak adapter and print the exact commands to
// upload it to a host (Vercel by default).
//
// Usage:
//   npm run deploy:check                 # reads env vars, else data/tidecloak.json
//   npm run deploy:check -- --target=print
//
// It never prints secrets: the adapter holds public client settings and the
// realm's public signing keys. It does print the adapter itself in the upload
// commands, because that is the value you paste into the host.

import { readFileSync } from "node:fs";
import path from "node:path";

const ADAPTER_ENV_KEYS = ["CLIENT_ADAPTER", "TIDECLOAK_ADAPTER", "CLIENT_ADAPTER_B64"];
const REQUIRED_FIELDS = ["realm", "auth-server-url", "resource"];
const LOCAL_ADAPTER_PATH = path.join(process.cwd(), "data", "tidecloak.json");

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function fail(message) {
  console.error(`${c.red("✗")} ${message}`);
  process.exit(1);
}

function resolveAdapter() {
  for (const key of ADAPTER_ENV_KEYS) {
    const raw = process.env[key];
    if (!raw || !raw.trim()) continue;
    const value = raw.trim();
    const json = key.endsWith("_B64") ? Buffer.from(value, "base64").toString("utf8") : value;
    if (!json.trim().startsWith("{")) {
      const decoded = Buffer.from(value, "base64").toString("utf8").trim();
      if (decoded.startsWith("{")) return { adapter: JSON.parse(decoded), source: `${key} (base64)` };
      fail(`${key} is not JSON and does not decode to JSON.`);
    }
    try {
      return { adapter: JSON.parse(json), source: key };
    } catch {
      fail(`${key} is not valid JSON. Compact it with: jq -c . data/tidecloak.json`);
    }
  }

  let raw;
  try {
    raw = readFileSync(LOCAL_ADAPTER_PATH, "utf8");
  } catch {
    fail(
      [
        "No adapter found.",
        "",
        "  Looked for: CLIENT_ADAPTER, TIDECLOAK_ADAPTER, CLIENT_ADAPTER_B64",
        `  and the file: ${LOCAL_ADAPTER_PATH}`,
        "",
        "  Run `npm run init` on the machine hosting TideCloak to export it.",
      ].join("\n"),
    );
  }

  try {
    return { adapter: JSON.parse(raw), source: "data/tidecloak.json" };
  } catch {
    fail("data/tidecloak.json is not valid JSON. Re-export it with `npm run init`.");
  }
}

function isLoopback(value) {
  try {
    const host = new URL(value).hostname;
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) || host.endsWith(".localhost");
  } catch {
    return false;
  }
}

const { adapter, source } = resolveAdapter();

console.log(`${c.green("✓")} Adapter found in ${c.bold(source)}`);

for (const field of REQUIRED_FIELDS) {
  if (typeof adapter[field] !== "string" || !adapter[field]) {
    fail(`Adapter is missing required field "${field}".`);
  }
}
if (!adapter.jwk) {
  fail(
    "Adapter is missing the jwk field. Re-export with IGA enabled " +
      "(providerId=keycloak-oidc-keycloak-json).",
  );
}
console.log(`${c.green("✓")} Required fields present (realm, auth-server-url, resource, jwk)`);
console.log(`${c.dim("  realm:")} ${adapter.realm}`);
console.log(`${c.dim("  auth-server-url:")} ${adapter["auth-server-url"]}`);
console.log(`${c.dim("  resource:")} ${adapter.resource}`);
console.log(
  `${c.dim("  jwk keys:")} ${Array.isArray(adapter.jwk.keys) ? adapter.jwk.keys.length : "none"}`,
);

let blocking = false;
const authServer = adapter["auth-server-url"];

if (isLoopback(authServer)) {
  blocking = true;
  console.error("");
  console.error(`${c.yellow("!")} ${c.bold("Sign-in will fail on a hosted deployment.")}`);
  console.error(
    `  auth-server-url is ${authServer}, which only resolves on this machine.`,
  );
  console.error("  A visitor's browser cannot reach your localhost. To deploy publicly,");
  console.error("  host TideCloak on a public HTTPS URL and re-export:");
  console.error("");
  console.error("    TIDECLOAK_URL=https://your-tidecloak-host ./scripts/init-tidecloak.sh");
  console.error("");
  console.error("  Until then, run the demo locally with `npm run dev`.");
}

if (typeof authServer === "string" && authServer.startsWith("http://") && !isLoopback(authServer)) {
  console.error("");
  console.error(`${c.yellow("!")} auth-server-url uses http:// — browsers block insecure`);
  console.error("  iframes/DPoP from an https:// deployment. Use an https:// URL.");
}

const compact = JSON.stringify(adapter);
const base64 = Buffer.from(compact, "utf8").toString("base64");

console.log("");
console.log(c.bold("Upload to Vercel"));
console.log(c.dim("  (run from the repo root; uses your own `vercel login` session)"));
console.log("");
console.log("  # one shot for all three environments:");
console.log(`  printf '%s' '${compact}' | npx vercel env add CLIENT_ADAPTER production --force`);
console.log(`  printf '%s' '${compact}' | npx vercel env add CLIENT_ADAPTER preview --force`);
console.log(`  printf '%s' '${compact}' | npx vercel env add CLIENT_ADAPTER development --force`);
console.log("");
console.log("  # if your dashboard mangles multi-line values, use base64 instead:");
console.log(`  printf '%s' '${base64}' | npx vercel env add CLIENT_ADAPTER_B64 production --force`);
console.log("");
console.log(`  ${c.bold("Then redeploy:")} npx vercel --prod   (env changes do not apply to old deployments)`);
console.log("");
console.log(c.dim("Or paste the values in Vercel → Settings → Environment Variables."));

process.exit(blocking ? 2 : 0);
