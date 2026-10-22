import { adapterDiagnostics, deploymentInfo, loadTideConfig, tideConfigWarnings, isHostedDeployment } from "@/lib/auth/tidecloakConfig";

// Serve adapter JSON for server-side use (e.g. JWT verification).
// The client gets the same config through TideCloakProvider's config prop, which
// the root layout fills from the server-resolved adapter (adapter env vars or
// data/tidecloak.json).
//
// It also reports the identity of the running deployment, so `curl /api/config`
// answers "which Vercel project, environment and commit is serving me?" — the
// question behind most "I set the variable but it is missing" reports.
export const dynamic = "force-dynamic";

export async function GET() {
  const deployment = deploymentInfo();
  try {
    const config = loadTideConfig();
    const warnings = tideConfigWarnings(config, {
      // A route handler has no browser hostname; trust the platform signal.
      servedFromLocalhost: !isHostedDeployment(),
    });
    return Response.json({ ...config, warnings, deployment });
  } catch (err) {
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Config not found",
        deployment,
        diagnostics: adapterDiagnostics(),
      },
      { status: 500 }
    );
  }
}
