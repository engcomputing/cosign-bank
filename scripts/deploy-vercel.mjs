#!/usr/bin/env node
// deploy — one command from "I have data/tidecloak.json" to "production works".
//
//   npm run deploy                 # upload adapter + deploy production
//   npm run deploy -- --dry-run    # print what would happen, change nothing
//   npm run deploy -- --env=production,preview
//   npm run deploy -- --target=preview
//
// It shells out to the Vercel CLI with YOUR login (`npx vercel login` once).
// The adapter is public configuration (public client settings + the realm's
// public signing keys), so uploading it as an environment variable is safe.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  colors as c,
  readAdapter,
  validateAdapter,
  isLoopbackUrl,
  adapterBase64,
} from "./lib/adapter.mjs";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const envArg = args.find((a) => a.startsWith("--env="));
const targetArg = args.find((a) => a.startsWith("--target="));
const environments = (envArg ? envArg.slice(6) : "production,preview,development")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((s) => ["production", "preview", "development"].includes(s));
const target = targetArg ? targetArg.slice(9) : "production";

function die(message) {
  console.error(`${c.red("✗")} ${message}`);
  process.exit(1);
}

if (environments.length === 0) die("--env must list production, preview or development.");

// --- 1. resolve the adapter locally -----------------------------------------
let resolved;
try {
  resolved = readAdapter({ fs: { readFileSync }, cwd: process.cwd(), path });
} catch (error) {
  die(error.message);
}

if (!resolved) {
  die(
    "No adapter found. Run `npm run init` (or set CLIENT_ADAPTER) first.\n" +
      "  Diagnose with: npm run deploy:check",
  );
}

const { adapter, source } = resolved;
try {
  validateAdapter(adapter, source);
} catch (error) {
  die(error.message);
}

console.log(`${c.green("✓")} Adapter loaded from ${c.bold(source)}`);
console.log(`${c.dim("  realm:")} ${adapter.realm}`);
console.log(`${c.dim("  auth-server-url:")} ${adapter["auth-server-url"]}`);

// --- 2. warn about a config that cannot work hosted --------------------------
let blocking = false;
if (isLoopbackUrl(adapter["auth-server-url"])) {
  blocking = true;
  console.error("");
  console.error(`${c.yellow("!")} ${c.bold("auth-server-url is loopback — sign-in cannot work on Vercel.")}`);
  console.error(`  ${adapter["auth-server-url"]} resolves only on this machine, never in a visitor's browser.`);
  console.error("  Deploying anyway only moves the failure from this page to the login button.");
  console.error("");
  console.error("  To host it: put TideCloak on a public HTTPS URL and re-export:");
  console.error("    TIDECLOAK_HOSTNAME=https://your-tidecloak-host CLIENT_APP_URL=https://your-app.vercel.app ./scripts/init-tidecloak.sh");
  console.error("    npm run verify:auth        # proves it is reachable and the issuer matches");
  console.error("");
  console.error("  For a local-only demo, skip this and run `npm run dev`.");
  if (!args.includes("--force")) {
    console.error("");
    console.error(`  Continue anyway with: ${c.bold("npm run deploy -- --force")}`);
    process.exit(2);
  }
  blocking = false;
}

const compact = JSON.stringify(adapter);
const base64 = adapterBase64(adapter);

// --- 3. upload ---------------------------------------------------------------
function run(command, commandArgs, input, label) {
  if (dryRun) {
    console.log(`${c.dim("[dry-run]")} ${label}: ${command} ${commandArgs.join(" ")}`);
    return;
  }
  const result = spawnSync(command, commandArgs, {
    input,
    stdio: ["pipe", "pipe", "pipe"],
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    die(`${label} failed${output ? `:\n${output}` : "."}`);
  }
  console.log(`${c.green("✓")} ${label}`);
}

// Sanity check the CLI + login before writing anything.
if (!dryRun) {
  const who = spawnSync("npx", ["--yes", "vercel", "whoami"], { encoding: "utf8" });
  if (who.status !== 0) {
    die(
      "Not logged in to Vercel (or the CLI is unavailable).\n" +
        "  Run `npx vercel login` (and `npx vercel link` in this repo), then retry.",
    );
  }
  console.log(`${c.green("✓")} Vercel CLI authenticated as ${(who.stdout || "").trim()}`);
}

for (const environment of environments) {
  run(
    "npx",
    ["--yes", "vercel", "env", "add", "CLIENT_ADAPTER", environment, "--force"],
    compact,
    `CLIENT_ADAPTER → ${environment}`,
  );
  // Base64 copy as a safety net for dashboards that mangle long values.
  run(
    "npx",
    ["--yes", "vercel", "env", "add", "CLIENT_ADAPTER_B64", environment, "--force"],
    base64,
    `CLIENT_ADAPTER_B64 → ${environment}`,
  );
}

// --- 4. deploy ---------------------------------------------------------------
const deployArgs = ["--yes", "vercel", ...(target === "preview" ? [] : ["--prod"])];
run("npx", deployArgs, undefined, target === "preview" ? "vercel (preview deploy)" : "vercel --prod");

console.log("");
console.log(`${c.green("Done.")} ${c.dim("Verify with: curl -s https://your-app.vercel.app/api/config | head -c 200")}`);
if (blocking) console.log(c.yellow("Reminder: this deployment still cannot sign in (loopback auth server)."));
