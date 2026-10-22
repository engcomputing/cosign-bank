#!/usr/bin/env node
// deploy — from "I have data/tidecloak.json" to "production is configured".
//
//   npm run deploy                              # linked project, production
//   npm run deploy -- --project=cosign-bank     # target a specific project first
//   npm run deploy -- --discover=https://app.vercel.app   # find the project serving that URL
//   npm run fix:vercel -- --url=https://app.vercel.app    # shorthand for the above
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
  vercelCommand,
} from "./lib/adapter.mjs";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const noDeploy = args.includes("--no-deploy");
const force = args.includes("--force");
const value = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const discoverUrl = value("discover") ?? value("url");
let project = value("project");
// The project we believe we are configuring. Set from --discover (authoritative)
// or from the CLI's own .vercel/project.json after linking.
let expectedProjectId = null;
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
const VC = vercelCommand();
const vcArgs = (...rest) => [...VC.slice(1), ...rest];

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

// --- 4. discover the project that serves a live deployment -------------------
// The failure this solves: variables added to a project with the same name as
// the one serving the URL. The deployment tells us its own project ID; we map
// that to a name and configure *that* project.
if (discoverUrl) {
  const endpoint = `${discoverUrl.replace(/\/+$/, "")}/api/config`;
  console.log("");
  console.log(`${c.dim("Discovering")} ${endpoint}`);
  let body = null;
  try {
    const response = await fetch(endpoint, { headers: { accept: "application/json" } });
    body = await response.json();
  } catch (error) {
    die(
      `Could not read ${endpoint} (${error instanceof Error ? error.message : error}).\n` +
        "  Pass the deployment URL (https://<app>.vercel.app), not the dashboard URL.",
    );
  }

  const servingProjectId =
    body?.deployment?.projectId ?? body?.diagnostics?.platform?.projectId ?? null;
  expectedProjectId = servingProjectId;
  const servingOrgId = body?.deployment?.orgId ?? body?.diagnostics?.platform?.orgId ?? null;

  if (!servingProjectId) {
    die(
      "That deployment did not report a project ID. It is running an older build;\n" +
        "  merge the branch with the diagnostic page, or pass --project=<name> directly.",
    );
  }

  console.log(`${c.dim("  serving project ID:")} ${servingProjectId}`);
  if (servingOrgId) console.log(`${c.dim("  org ID:")} ${servingOrgId}`);
  if (responseHadAdapter(body)) {
    console.log(`${c.yellow("!")} That deployment already has a usable adapter; re-running with the`);
    console.log("  project below will just redeploy it.");
  }

  if (!dryRun) {
    const who = spawnSync(VC[0], vcArgs("whoami"), { encoding: "utf8" });
    if (who.status !== 0) {
      die(
        "Not logged in to Vercel. Run `npx vercel login`, then re-run this command.",
      );
    }
    const listing = spawnSync(VC[0], vcArgs("project", "ls", "--format", "json", ...scopeArgs), {
      encoding: "utf8",
    });
    let rows = [];
    try {
      const parsed = JSON.parse(listing.stdout ?? "[]");
      rows = Array.isArray(parsed) ? parsed : (parsed.projects ?? []);
    } catch {
      rows = [];
    }
    const match = rows.find(
      (row) => (row.id ?? row.projectId ?? null) === servingProjectId,
    );
    if (!match) {
      die(
        [
          `No project visible to this login has ID ${servingProjectId}.`,
          "",
          "  It probably lives in another team/scope. Try:",
          `    npm run deploy -- --discover=${discoverUrl} --scope=<team-slug>`,
          "",
          "  Or list what this login can see:  npx vercel project ls",
        ].join("\n"),
      );
    }
    const name = match.name;
    console.log(`${c.green("✓")} That URL is served by project ${c.bold(name)} (${servingProjectId})`);
    if (project && project !== name) {
      console.log(`${c.yellow("!")} --project=${project} was ignored in favour of the discovered project.`);
    }
    project = name;
  }
}

function responseHadAdapter(body) {
  return Boolean(body && typeof body === "object" && body["auth-server-url"]);
}

// --- 5. auth + target project ----------------------------------------------
if (!dryRun) {
  const who = spawnSync(VC[0], vcArgs("whoami"), { encoding: "utf8" });
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
    VC[0],
    vcArgs("link", "--yes", "--project", project, ...scopeArgs),
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

// --- 6. upload ---------------------------------------------------------------
for (const environment of environments) {
  run(
    VC[0],
    vcArgs("env", "add", "CLIENT_ADAPTER", environment, "--force", ...scopeArgs),
    compact,
    `CLIENT_ADAPTER → ${environment}`,
  );
  run(
    VC[0],
    vcArgs("env", "add", "CLIENT_ADAPTER_B64", environment, "--force", ...scopeArgs),
    base64,
    `CLIENT_ADAPTER_B64 → ${environment}`,
  );
}

// --- 7. deploy + verify ------------------------------------------------------
if (noDeploy) {
  console.log("");
  console.log(c.yellow("Uploaded only (--no-deploy). Existing deployments keep the old config."));
  process.exit(0);
}

const deployArgs = vcArgs(...(target === "preview" ? [] : ["--prod"]), ...scopeArgs);
const deployed = run(VC[0], deployArgs, undefined, target === "preview" ? "vercel (preview)" : "vercel --prod");

if (dryRun) {
  console.log("");
  console.log(c.dim("Dry run complete. Nothing was uploaded or deployed."));
  process.exit(0);
}

// Best-effort: read the deployment URL out of the CLI output and ask the app
// itself which project/environment it thinks it is.
const deploymentUrl = (deployed.stdout.match(/https?:\/\/[^\s]+/g) ?? []).pop();

async function verifyDeployment() {
  if (!deploymentUrl) {
    console.log("");
    console.log(c.dim("No deployment URL detected in CLI output; verify manually:"));
    console.log(c.dim("  curl -s https://<your-app>/api/config"));
    return;
  }

  const verifyUrl = `${deploymentUrl.replace(/\/+$/, "")}/api/config`;
  console.log("");
  console.log(`${c.dim("Verifying")} ${verifyUrl}`);
  let body = null;
  try {
    const response = await fetch(verifyUrl, {
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
  const localProjectId = expectedProjectId ?? linkedProjectId();
  if (deployedProjectId && localProjectId) {
    if (deployedProjectId === localProjectId) {
      console.log(`${c.green("✓")} Served by the project you configured (${deployedProjectId})`);
    } else {
      console.log(
        `${c.red("✗")} Project mismatch: this URL is served by ${deployedProjectId}, ` +
          `but you configured ${localProjectId}.`,
      );
      console.log(
        `  A duplicate Vercel project is building this repo. Delete one, or run:\n` +
          `    npm run deploy -- --discover=${deploymentUrl}`,
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
