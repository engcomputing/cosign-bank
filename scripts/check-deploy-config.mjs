#!/usr/bin/env node
// deploy:check — validate the TideCloak adapter and print the exact commands to
// upload it to a host (Vercel by default).
//
//   npm run deploy:check
//   npm run verify:auth          # additionally prove the realm is reachable
//
// Never prints secrets: the adapter holds public client settings and the realm's
// public signing keys. It prints the adapter in the upload commands, because
// that is the value you paste into the host.

import { readFileSync } from "node:fs";
import path from "node:path";
import {
  colors as c,
  readAdapter,
  validateAdapter,
  isLoopbackUrl,
  isHttpUrl,
  adapterBase64,
} from "./lib/adapter.mjs";

const fail = (message) => {
  console.error(`${c.red("✗")} ${message}`);
  process.exit(1);
};

let resolved;
try {
  resolved = readAdapter({ fs: { readFileSync }, cwd: process.cwd(), path });
} catch (error) {
  fail(error.message);
}

if (!resolved) {
  fail(
    [
      "No adapter found.",
      "",
      "  Looked for: CLIENT_ADAPTER, TIDECLOAK_ADAPTER, CLIENT_ADAPTER_B64",
      `  and the file: ${path.join(process.cwd(), "data", "tidecloak.json")}`,
      "",
      "  Run `npm run init` on the machine hosting TideCloak to export it.",
    ].join("\n"),
  );
}

const { adapter, source } = resolved;
try {
  validateAdapter(adapter, source);
} catch (error) {
  fail(error.message);
}

console.log(`${c.green("✓")} Adapter found in ${c.bold(source)}`);
console.log(`${c.green("✓")} Required fields present (realm, auth-server-url, resource, jwk)`);
console.log(`${c.dim("  realm:")} ${adapter.realm}`);
console.log(`${c.dim("  auth-server-url:")} ${adapter["auth-server-url"]}`);
console.log(`${c.dim("  resource:")} ${adapter.resource}`);
console.log(
  `${c.dim("  jwk keys:")} ${Array.isArray(adapter.jwk.keys) ? adapter.jwk.keys.length : "none"}`,
);

const authServer = adapter["auth-server-url"];
let blocking = false;

if (isLoopbackUrl(authServer)) {
  blocking = true;
  console.error("");
  console.error(`${c.yellow("!")} ${c.bold("Sign-in will fail on a hosted deployment.")}`);
  console.error(`  auth-server-url is ${authServer}, which only resolves on this machine.`);
  console.error("  A visitor's browser cannot reach your localhost. To deploy publicly,");
  console.error("  host TideCloak on a public HTTPS URL and re-export:");
  console.error("");
  console.error("    TIDECLOAK_HOSTNAME=https://your-tidecloak-host ./scripts/init-tidecloak.sh");
  console.error("    npm run verify:auth        # proves it is reachable and the issuer matches");
  console.error("");
  console.error("  Until then, run the demo locally with `npm run dev`.");
}

if (isHttpUrl(authServer) && !isLoopbackUrl(authServer)) {
  console.error("");
  console.error(`${c.yellow("!")} auth-server-url uses http:// — browsers block insecure`);
  console.error("  iframes/DPoP from an https:// deployment. Use an https:// URL.");
}

const compact = JSON.stringify(adapter);
const base64 = adapterBase64(adapter);

console.log("");
console.log(c.bold("Upload to Vercel"));
console.log(c.dim("  (run from the repo root; uses your own `vercel login` session)"));
console.log("");
console.log(c.dim("  one command instead of all of this: npm run deploy"));
console.log("");
console.log("  # one shot for all three environments:");
for (const environment of ["production", "preview", "development"]) {
  console.log(`  printf '%s' '${compact}' | npx vercel env add CLIENT_ADAPTER ${environment} --force`);
}
console.log("");
console.log("  # if your dashboard mangles multi-line values, use base64 instead:");
console.log(`  printf '%s' '${base64}' | npx vercel env add CLIENT_ADAPTER_B64 production --force`);
console.log("");
console.log(`  ${c.bold("Then redeploy:")} npx vercel --prod   (env changes do not apply to old deployments)`);
console.log("");
console.log(c.dim("Or paste the values in Vercel → Settings → Environment Variables."));

process.exit(blocking ? 2 : 0);
