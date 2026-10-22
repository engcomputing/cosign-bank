#!/usr/bin/env node
// diagnose — find out which Vercel project/env actually holds the adapter, and
// whether it is the project serving a given deployment.
//
//   npm run diagnose -- --url=https://cosign-bank-764uayugt-team.vercel.app
//   npm run diagnose -- --project-id=prj_8cvlAAawZkKCAugEVkwm8tw3VKSG
//   npm run diagnose -- --project-id=prj_... --scope=my-team --search
//
// Reads the deployment's own /api/config diagnostics (no auth needed), then uses
// your Vercel CLI session to inspect candidate projects. `--search` scans the
// projects visible to you for CLIENT_ADAPTER, which is how you find the case
// "I added it to a different project with the same name".
//
// Needs: npx vercel login (run once). Nothing is modified.

import { spawnSync } from "node:child_process";
import { colors as c, vercelCommand } from "./lib/adapter.mjs";

const args = process.argv.slice(2);
const value = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const flag = (name) => args.includes(`--${name}`);
const timeoutMs = Number(value("timeout") ?? 8000);

const url = value("url");
const scope = value("scope");
const projectIdArg = value("project-id");
const search = flag("search");

function sh(command, commandArgs, opts = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    env: { ...process.env, ...(opts.env ?? {}) },
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

const VC = vercelCommand();
function vercel(commandArgs, opts) {
  return sh(VC[0], [...VC.slice(1), ...commandArgs], opts);
}

// --- 1. what does the deployment say about itself? ---------------------------
let deployment = null;
let configError = null;

if (url) {
  const endpoint = `${url.replace(/\/+$/, "")}/api/config`;
  console.log(`${c.dim("Fetching")} ${endpoint}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    const body = await response.json();
    if (response.ok) {
      deployment = body.deployment ?? null;
      console.log(`${c.green("✓")} Deployment has a working adapter`);
    } else {
      configError = body.error ?? `HTTP ${response.status}`;
      deployment = body.deployment ?? body.diagnostics?.platform ?? null;
      console.log(`${c.yellow("!")} Deployment has no usable adapter`);
    }
  } catch (error) {
    console.error(
      `${c.red("✗")} Could not reach ${endpoint}: ${error instanceof Error ? error.message : error}`,
    );
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }
} else if (!projectIdArg) {
  console.error(
    [
      "Tell me which deployment to inspect:",
      "",
      "  npm run diagnose -- --url=https://<your-app>.vercel.app",
      "  npm run diagnose -- --project-id=prj_...",
      "",
      "The project ID is printed on the setup page and by /api/config.",
    ].join("\n"),
  );
  process.exit(1);
}

const targetProjectId = projectIdArg ?? deployment?.projectId ?? null;
const targetEnvironment = deployment?.environment ?? "production";

if (deployment) {
  console.log("");
  console.log(c.bold("Deployment identity"));
  console.log(`  project ID : ${deployment.projectId ?? "unknown"}`);
  console.log(`  org ID     : ${deployment.orgId ?? "unknown"}`);
  console.log(`  environment: ${deployment.environment ?? "unknown"}`);
  console.log(`  branch     : ${deployment.branch ?? "unknown"}`);
  console.log(`  commit     : ${(deployment.commitSha ?? "unknown").slice(0, 12)}`);
  if (configError) console.log(`  ${c.dim("reason")}     : ${configError}`);
}

// --- 2. is the CLI usable? ---------------------------------------------------
const who = vercel(["whoami"]);
if (!who.ok) {
  console.error("");
  console.error(`${c.red("✗")} Vercel CLI is not authenticated (or unavailable).`);
  console.error("  Run `npx vercel login`, then re-run this command.");
  process.exit(1);
}
console.log("");
console.log(`${c.green("✓")} Vercel CLI authenticated as ${who.stdout.trim()}`);

// --- 3. resolve the project that serves the deployment -----------------------
const scopeArgs = scope ? ["--scope", scope] : [];

function listProjects() {
  // Prefer JSON; fall back to the human table if the CLI version differs.
  const json = vercel(["project", "ls", "--format", "json", ...scopeArgs]);
  if (json.ok) {
    try {
      const parsed = JSON.parse(json.stdout);
      const rows = Array.isArray(parsed) ? parsed : (parsed.projects ?? []);
      if (rows.length > 0) {
        return rows.map((row) => ({
          id: row.id ?? row.projectId ?? null,
          name: row.name ?? "(unnamed)",
          orgId: row.orgId ?? null,
        }));
      }
    } catch {
      // fall through to table parsing
    }
  }
  const table = vercel(["project", "ls", ...scopeArgs]);
  if (!table.ok) return null;
  return table.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^(name|project|─|-)/i.test(line) && !/^\W/.test(line))
    .map((line) => {
      const cells = line.split(/\s{2,}/);
      return { id: null, name: cells[0], orgId: null };
    });
}

const projects = listProjects();
if (!projects) {
  console.error(`${c.red("✗")} Could not list projects. Check \`npx vercel project ls\` by hand.`);
}

const targetProject = projects?.find((project) => project.id === targetProjectId) ?? null;

if (projects) {
  console.log("");
  console.log(c.bold(`Projects visible to this login (${projects.length})`));
  const sameName = projects.filter(
    (project) => targetProject?.name && project.name === targetProject.name,
  );
  for (const project of projects) {
    const marker = project.id && project.id === targetProjectId ? `${c.green("→ serving you")}` : "";
    console.log(`  ${project.name}${project.id ? ` ${c.dim(project.id)}` : ""} ${marker}`);
  }

  if (targetProject) {
    console.log("");
    console.log(`${c.green("✓")} The deployment is project ${c.bold(targetProject.name)} (${targetProject.id})`);
    if (sameName.length > 1) {
      console.log(
        `${c.yellow("!")} ${sameName.length} projects share that name — a duplicate is the classic ` +
          "reason a variable \"disappears\".",
      );
    }
  } else if (targetProjectId) {
    console.log("");
    console.log(
      `${c.yellow("!")} No visible project has ID ${targetProjectId}. It may live in another ` +
        "team/scope: retry with --scope=<team-slug>.",
    );
  }
}

// --- 4. does the serving project have the adapter? ---------------------------
function envList({ projectId, orgId }) {
  const env = {};
  if (projectId && orgId) {
    env.VERCEL_PROJECT_ID = projectId;
    env.VERCEL_ORG_ID = orgId;
  }
  const result = vercel(["env", "ls", targetEnvironment, ...scopeArgs], { env });
  if (!result.ok) return { ok: false, output: result.stderr || result.stdout };
  return { ok: true, output: `${result.stdout}${result.stderr}` };
}

const ADAPTER_KEYS = ["CLIENT_ADAPTER", "TIDECLOAK_ADAPTER", "CLIENT_ADAPTER_B64"];

if (targetProject?.id) {
  const listing = envList({ projectId: targetProject.id, orgId: targetProject.orgId });
  console.log("");
  if (!listing.ok) {
    console.log(
      `${c.yellow("!")} Could not list env vars for ${targetProject.name}: ` +
        listing.output.trim().split("\n")[0],
    );
    console.log(c.dim("  Fallback: Vercel → this project → Settings → Environment Variables."));
  } else {
    const found = ADAPTER_KEYS.filter((key) => listing.output.includes(key));
    if (found.length > 0) {
      console.log(
        `${c.green("✓")} ${targetEnvironment} has ${found.join(", ")} on ${targetProject.name}.`,
      );
      console.log(
        c.dim("  If the deployment page still says missing, it was built before you added them — redeploy."),
      );
    } else {
      console.log(
        `${c.red("✗")} ${targetEnvironment} has no adapter variable on ${targetProject.name} ` +
          `(${targetProject.id}).`,
      );
      if (deployment?.projectId) {
        console.log(
          `  Fix, targeted at this exact project:\n` +
            `    npm run deploy -- --project=${targetProject.name}${scope ? ` --scope=${scope}` : ""}`,
        );
      }
    }
  }
}

// --- 5. optional: where else does the adapter live? -------------------------
if (search && projects) {
  console.log("");
  console.log(c.bold("Searching other projects for the adapter (this can take a minute)"));
  let hits = 0;
  for (const project of projects) {
    if (!project.id || project.id === targetProjectId) continue;
    const listing = envList({ projectId: project.id, orgId: project.orgId });
    if (!listing.ok) continue;
    const found = ADAPTER_KEYS.filter((key) => listing.output.includes(key));
    if (found.length > 0) {
      hits += 1;
      console.log(
        `  ${c.yellow("!")} ${project.name} (${project.id}) has ${found.join(", ")} ` +
          `but does not serve this URL`,
      );
    }
  }
  if (hits === 0) {
    console.log(`  ${c.dim("No other project has it. The variable was probably never added.")}`);
  }
}

console.log("");
console.log(c.dim("Next: npm run deploy -- --project=<name>  (uploads the adapter, deploys, verifies)"));
