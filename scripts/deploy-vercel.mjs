#!/usr/bin/env node
// deploy — from "I have data/tidecloak.json" to "production is configured".
//
//   npm run deploy                              # linked project, production
//   npm run deploy -- --project=cosign-bank     # target a specific project first
//   npm run deploy -- --project=cosign-bank --scope=my-team
//   npm run deploy -- --dry-run                 # print the plan, change nothing
//   npm run deploy -- --env=production,preview  # environments to set
//   npm run deploy -- --no-deploy               # upload vars only
//
// It shells out to the Vercel CLI with YOUR login (`npx vercel login` once).
// After deploying it fetches <url>/api/config and confirms that the *deployed*
// project is the one you just configured — the check that catches "I put the
// variable on a different project with the same name".
//
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
const noDeploy = args.includes("--no-deploy");
const force = args.includes("--force");
const value = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const project = value("project");
const scope = value("scope");
const target = value("target") === "preview" ? "preview" : "production";
const environments = (value("env") ?? "production,preview,development")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => ["production", "preview", "development"].includes(s));

const die = (message) => {
  console.error(`${c.red("✗")} ${message}`);
  process.exit(1);
};

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

// --- 2. refuse a config that cannot work hosted -----------------------------
if (isLoopbackUrl(adapter["auth-server-url"])) {
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
  if (!force) {
    console.error("");
    console.error(`  Continue anyway with: ${c.bold("npm run deploy -- --force")}`);
    process.exit(2);
  }
  console.error("");
  console.error(`${c.yellow("!")} Continuing because --force was passed.`);
}

const compact = JSON.stringify(adapter);
const base64 = adapterBase64(adapter);
const scopeArgs = scope ? ["--scope", scope] : [];

// --- 3. helpers -------------------------------------------------------------
function run(command, commandArgs, input, label) {
  if (dryRun) {
    console.log(`${c.dim("[dry-run]")} ${label}: ${command} ${commandArgs.join(" ")}`);
    return { ok: true, stdout: "" };
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
  return { ok: true, stdout: result.stdout ?? "" };
}

// --- 4. auth + target project ----------------------------------------------
if (!dryRun) {
  const who = spawnSync("npx", ["--yes", "vercel", "whoami"], { encoding: "utf8" });
  if (who.status !== 0) {
    die(
      "Not logged in to Vercel (or the CLI is unavailable).\n" +
        "  Run `npx vercel login`, then retry.",
    );
  }
  console.log(`${c.green("✓")} Vercel CLI authenticated as ${(who.stdout || "").trim()}`);
}

if (project) {
  // Linking explicitly is the fix for "I configured the wrong project": env
  // commands and deploys act on the linked project only.
  run(
    "npx",
    ["--yes", "vercel", "link", "--yes", "--project", project, ...scopeArgs],
    undefined,
    `linked this directory to project ${project}${scope ? ` (scope ${scope})` : ""}`,
  );
} else if (!dryRun) {
  const linked = linkedProjectId();
  if (linked) {
    console.log(
      `${c.dim("  project:")} ${linked} ${c.dim("(from .vercel/project.json)")}`,
    );
    console.log(
      c.dim("  Not the project serving your URL? Re-run with --project=<name>."),
    );
  }
}

function linkedProjectId() {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".vercel", "project.json"), "utf8");
    const parsed = JSON.parse(raw);
    return parsed.projectId ?? null;
  } catch {
    return null;
  }
}

// --- 5. upload ---------------------------------------------------------------
for (const environment of environments) {
  run(
    "npx",
    ["--yes", "vercel", "env", "add", "CLIENT_ADAPTER", environment, "--force", ...scopeArgs],
    compact,
    `CLIENT_ADAPTER → ${environment}`,
  );
  run(
    "npx",
    ["--yes", "vercel", "env", "add", "CLIENT_ADAPTER_B64", environment, "--force", ...scopeArgs],
    base64,
    `CLIENT_ADAPTER_B64 → ${environment}`,
  );
}

// --- 6. deploy + verify ------------------------------------------------------
if (noDeploy) {
  console.log("");
  console.log(c.yellow("Uploaded only (--no-deploy). Existing deployments keep the old config."));
  process.exit(0);
}

const deployArgs = ["--yes", "vercel", ...(target === "preview" ? [] : ["--prod"]), ...scopeArgs];
const deployed = run("npx", deployArgs, undefined, target === "preview" ? "vercel (preview)" : "vercel --prod");

if (dryRun) {
  console.log("");
  console.log(c.dim("Dry run complete. Nothing was uploaded or deployed."));
  process.exit(0);
}

// Best-effort: read the deployment URL out of the CLI output and ask the app
// itself which project/environment it thinks it is.
const deploymentUrl = (deployed.stdout.match(/https:\/\/[^\s]+\.vercel\.app/g) ?? []).pop();

async function verifyDeployment() {
  if (!deploymentUrl) {
    console.log("");
    console.log(c.dim("No deployment URL detected in CLI output; verify manually:"));
    console.log(c.dim("  curl -s https://<your-app>/api/config"));
    return;
  }

  console.log("");
  console.log(`${c.dim("Verifying")} ${deploymentUrl}/api/config`);
  let body = null;
  try {
    const response = await fetch(`${deploymentUrl}/api/config`, {
      headers: { accept: "application/json" },
    });
    body = await response.json();
    if (!response.ok) {
      console.log(`${c.red("✗")} The new deployment still has no usable adapter.`);
      if (body?.error) console.log(`  ${body.error}`);
      if (body?.diagnostics) {
        for (const sourceEntry of body.diagnostics.sources ?? []) {
          console.log(`  ${sourceEntry.key}: ${sourceEntry.status}`);
        }
      }
      console.log("");
      console.log("  Common causes, in order:");
      console.log("   1. a duplicate Vercel project is serving this URL — compare the");
      console.log("      project ID below with the one you configured:");
      console.log(`      ${body?.deployment?.projectId ?? "(unknown)"}`);
      console.log("   2. the variables went to another environment (--env=...)");
      console.log("   3. you are looking at an older deployment URL");
      console.log("");
      console.log(c.dim("  Run: npm run diagnose -- --url=" + deploymentUrl));
      process.exitCode = 1;
      return;
    }
    console.log(`${c.green("✓")} Deployment reports a working adapter`);
  } catch (error) {
    console.log(
      `${c.yellow("!")} Could not fetch /api/config (${error instanceof Error ? error.message : error}).`,
    );
    return;
  }

  const deployedProjectId = body?.deployment?.projectId ?? null;
  const localProjectId = linkedProjectId();
  if (deployedProjectId && localProjectId) {
    if (deployedProjectId === localProjectId) {
      console.log(`${c.green("✓")} Served by the project you configured (${deployedProjectId})`);
    } else {
      console.log(
        `${c.red("✗")} Project mismatch: this URL is served by ${deployedProjectId}, ` +
          `but you configured ${localProjectId}.`,
      );
      console.log(
        `  Fix: npm run deploy -- --project=<name-of-${deployedProjectId}>` +
          "  (or delete the duplicate project)",
      );
      process.exitCode = 1;
    }
  }
  for (const warning of body?.warnings ?? []) console.log(`${c.yellow("!")} ${warning}`);
}

await verifyDeployment();
if (!process.exitCode) {
  console.log("");
  console.log(`${c.green("Done.")} ${c.dim("Sign-in needs a publicly reachable TideCloak: npm run verify:auth")}`);
}
