import { loadTideConfig, tideConfigWarnings, isHostedDeployment } from "@/lib/auth/tidecloakConfig";

// Serve adapter JSON for server-side use (e.g. JWT verification).
// The client gets the same config through TideCloakProvider's config prop, which
// the root layout fills from the server-resolved adapter (adapter env vars or
// data/tidecloak.json). This route serves any other server-side consumer.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = loadTideConfig();
    const warnings = tideConfigWarnings(config, {
      // A route handler has no browser hostname; trust the platform signal.
      servedFromLocalhost: !isHostedDeployment(),
    });
    return Response.json(warnings.length > 0 ? { ...config, warnings } : config);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Config not found" },
      { status: 500 }
    );
  }
}
