import { loadTideConfig } from "@/lib/auth/tidecloakConfig";

// Serve adapter JSON for server-side use (e.g. JWT verification).
// The client gets the same config through TideCloakProvider's config prop, which
// the root layout fills from the server-resolved adapter (CLIENT_ADAPTER or
// data/tidecloak.json). This route serves any other server-side consumer.
export async function GET() {
  try {
    const config = loadTideConfig();
    return Response.json(config);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Config not found" },
      { status: 500 }
    );
  }
}
