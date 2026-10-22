#!/usr/bin/env node
// verify:auth — prove the adapter in hand corresponds to a LIVE TideCloak realm
// that a browser can actually reach.
//
//   npm run verify:auth                       # adapter from env, else data/tidecloak.json
//   npm run verify:auth -- --url=https://tidecloak.example.com/ --rewrite
//   npm run verify:auth -- --allow-local      # self-hosted on a LAN / testing
//
// Checks, in order:
//   1. https://, not loopback (unless --allow-local)
//   2. OIDC discovery reachable
//   3. discovery.issuer === <auth-server-url>/realms/<realm>   ← OIDC clients break otherwise
//   4. jwks_uri reachable and its keys cover the adapter's embedded jwk kids
//
// --rewrite updates data/tidecloak.json's auth-server-url to --url, but only when
// discovery confirms that URL is the realm's issuer.
//
// Use this after re-exporting an adapter for a public host, before `npm run deploy`.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  colors as c,
  readAdapter,
  validateAdapter,
  isLoopbackUrl,
  isHttpUrl,
} from "./lib/adapter.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const allowLocal = flag("allow-local");
const rewrite = flag("rewrite");
const urlOverride = value("url");
const timeoutMs = Number(value("timeout") ?? 8000);

const problems = [];
const notes = [];

function problem(message) {
  problems.push(message);
  console.error(`${c.red("✗")} ${message}`);
}

function ok(message) {
  console.log(`${c.green("✓")} ${message}`);
}

function note(message) {
  notes.push(message);
  console.log(`${c.yellow("!")} ${message}`);
}

// --- adapter -----------------------------------------------------------------
let resolved;
try {
  resolved = readAdapter({ fs: { readFileSync }, cwd: process.cwd(), path });
} catch (error) {
  console.error(`${c.red("✗")} ${error.message}`);
  process.exit(1);
}

if (!resolved) {
  console.error(`${c.red("✗")} No adapter found. Run \`npm run init\` or set CLIENT_ADAPTER.`);
  process.exit(1);
}

let { adapter, source } = resolved;
try {
  validateAdapter(adapter, source);
} catch (error) {
  console.error(`${c.red("✗")} ${error.message}`);
  process.exit(1);
}
ok(`Adapter loaded from ${c.bold(source)} (realm ${adapter.realm})`);

if (urlOverride) {
  adapter = { ...adapter, "auth-server-url": urlOverride.replace(/\/+$/, "") };
  note(`auth-server-url overridden by --url: ${adapter["auth-server-url"]}`);
}

const authServer = adapter["auth-server-url"].replace(/\/+$/, "");

// --- 1. shape of the URL ------------------------------------------------------
const local = isLoopbackUrl(authServer);

if (local) {
  const message =
    `auth-server-url is ${authServer} — loopback. A browser on another machine ` +
    "cannot resolve it, so hosted sign-in cannot work.";
  if (allowLocal) note(message);
  else problem(message);
}

if (isHttpUrl(authServer) && !(allowLocal && local)) {
  problem(
    `auth-server-url is plain http:// (${authServer}). Browsers block the DPoP/iframe ` +
      "flow from an https:// app. Put TideCloak behind HTTPS.",
  );
} else if (authServer.startsWith("https://")) {
  ok(`auth-server-url is public HTTPS (${authServer})`);
} else if (!local) {
  problem(`auth-server-url must start with https:// (got ${authServer}).`);
}

// --- 2. discovery ------------------------------------------------------------
const rtrim = (valueToTrim) => valueToTrim.replace(/\/+$/, "");
const discoveryUrl = `${rtrim(authServer)}/realms/${encodeURIComponent(adapter.realm)}/.well-known/openid-configuration`;

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      return { ok: false, status: response.status, body: await response.text().catch(() => "") };
    }
    return { ok: true, status: response.status, json: await response.json() };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

console.log(`${c.dim("  discovery:")} ${discoveryUrl}`);
const discovery = await getJson(discoveryUrl);

if (!discovery.ok) {
  problem(
    `OpenID discovery failed (${discovery.status || discovery.error}). The realm is not ` +
      "reachable from this machine. Hosts to check: TideCloak is running, the reverse proxy " +
      `is up, the path /realms/${adapter.realm} is routed, and DNS points at it.`,
  );
} else {
  ok("OIDC discovery reachable");

  const issuer = typeof discovery.json.issuer === "string" ? discovery.json.issuer : null;
  const expectedIssuer = `${rtrim(authServer)}/realms/${adapter.realm}`;

  if (!issuer) {
    problem("Discovery document has no issuer.");
  } else if (rtrim(issuer) !== expectedIssuer) {
    problem(
      `Issuer mismatch.\n    discovery says: ${issuer}\n    adapter expects: ${expectedIssuer}\n` +
        "  Tokens would fail verification. Fix the server, not the adapter: start TideCloak " +
        `with KC_HOSTNAME=${rtrim(authServer)} (and KC_PROXY_HEADERS=xforwarded behind a ` +
        "TLS-terminating proxy), then re-run `npm run init` to re-export.",
    );
  } else {
    ok(`Issuer matches the adapter (${issuer})`);
  }

  // --- 3. JWKS -------------------------------------------------------------
  const jwksUri = discovery.json.jwks_uri;
  if (!jwksUri) {
    problem("Discovery document has no jwks_uri.");
  } else {
    console.log(`${c.dim("  jwks:")} ${jwksUri}`);
    const jwks = await getJson(jwksUri);
    if (!jwks.ok) {
      problem(`JWKS fetch failed (${jwks.status || jwks.error}) at ${jwksUri}.`);
    } else {
      const liveKids = new Set(
        (Array.isArray(jwks.json.keys) ? jwks.json.keys : []).map((k) => k.kid).filter(Boolean),
      );
      const adapterKids = new Set(
        (Array.isArray(adapter.jwk?.keys) ? adapter.jwk.keys : [])
          .map((k) => k.kid)
          .filter(Boolean),
      );

      if (liveKids.size === 0) {
        problem("The realm publishes no signing keys (is IGA initialised?).");
      } else if (adapterKids.size === 0) {
        note(
          `Realm publishes ${liveKids.size} signing key(s); the adapter embeds none. ` +
            "Token verification uses the embedded jwk, so re-export the adapter.",
        );
      } else {
        const covered = [...adapterKids].every((kid) => liveKids.has(kid));
        if (covered) {
          ok(`Adapter jwk kids are published by the live realm (${adapterKids.size} key(s))`);
        } else {
          problem(
            "The adapter's jwk kids are not among the realm's live keys — it is stale. " +
              "Re-export it with `npm run init`.",
          );
        }
      }
    }
  }
}

// --- rewrite ----------------------------------------------------------------
if (rewrite && urlOverride) {
  const file = path.join(process.cwd(), "data", "tidecloak.json");
  if (!existsSync(file)) {
    console.error(`${c.red("✗")} --rewrite needs data/tidecloak.json; it does not exist.`);
  } else if (problems.length > 0) {
    console.error(`${c.red("✗")} --rewrite refused: fix the problems above first.`);
  } else {
    const current = JSON.parse(readFileSync(file, "utf8"));
    current["auth-server-url"] = authServer;
    writeFileSync(file, `${JSON.stringify(current, null, 2)}\n`, "utf8");
    ok(`Rewrote auth-server-url in data/tidecloak.json to ${authServer}`);
  }
}

// --- verdict ----------------------------------------------------------------
console.log("");
if (problems.length > 0) {
  console.error(`${c.red("NOT READY")} — ${problems.length} problem(s) above.`);
  process.exit(1);
}
console.log(`${c.green("READY")} — this adapter points at a reachable realm with matching issuer.`);
console.log(c.dim("Next: npm run deploy   (uploads the adapter and deploys production)"));
if (notes.length > 0) {
  console.log("");
  notes.forEach((message) => console.log(`${c.yellow("!")} ${message}`));
}
