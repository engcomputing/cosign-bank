import { NextRequest } from "next/server";
import { verifyTideJWT, hasRole, extractToken } from "./tideJWT";
import { verifyDpop } from "./verifyDpop";
import { verifyDemoToken } from "./demo-identity";
import { authMode } from "./authMode";
import type { JWTPayload } from "jose";

// Playbook: verify-jwt-server-side Step 5
//
// One door, two implementations behind it:
//
//   tidecloak  → verify the Tide JWT signature/issuer/azp AND the DPoP binding.
//                A stolen token replays as a bare Bearer unless the proof is checked
//                (AP-43), so both are required.
//   simulated  → verify the simulator's HMAC token. No DPoP: there is no
//                sender-constrained token to bind. The mode is reported in API
//                responses so a client can tell the difference.
//
// Route handlers never branch on the mode; they receive a verified JWTPayload and
// run the same role checks either way. That is the point: swapping the simulator for
// TideCloak changes configuration, not application code.
type AuthHandler = (req: NextRequest, jwt: JWTPayload) => Promise<Response>;

export function withAuth(handler: AuthHandler) {
  return async (req: NextRequest) => {
    try {
      const mode = authMode();

      if (mode === "unconfigured") {
        return Response.json(
          {
            error:
              "Authentication is not configured on this deployment. Set a TideCloak adapter " +
              "(CLIENT_ADAPTER / CLIENT_ADAPTER_B64) or enable the simulated identity with DEMO_AUTH=1.",
            authMode: mode,
          },
          { status: 503 },
        );
      }

      const token = extractToken(req.headers.get("authorization"));

      if (mode === "simulated") {
        const jwt = await verifyDemoToken(token);
        return handler(req, jwt);
      }

      const jwt = await verifyTideJWT(token);
      await verifyDpop(req, token, jwt as { cnf?: { jkt?: string } });
      return handler(req, jwt);
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Unauthorized" },
        { status: 401 }
      );
    }
  };
}

export function withRole(role: string, handler: AuthHandler) {
  return withAuth(async (req, jwt) => {
    if (!hasRole(jwt, role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    return handler(req, jwt);
  });
}
