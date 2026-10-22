"use client";

import { useTideCloak } from "@/lib/tide/bridge";

// Persistent banner for simulated-identity mode.
//
// Shown above every screen while the app authenticates against the simulator
// instead of TideCloak. Deliberately unmissable and un-dismissable: a screenshot of
// this prototype must never be mistakable for a real Tide-protected deployment.
// It also shows which simulated owner (and therefore which role) is acting, and
// lets you switch — the demo needs three distinct subjects.
export function SimulatedIdentityBanner() {
  const { persona, authenticated, login, logout } = useTideCloak();

  return (
    <div
      role="status"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "8px 14px",
        padding: "10px 24px",
        background: "#0b3b31",
        color: "#d8ff72",
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <strong style={{ letterSpacing: ".02em" }}>SIMULATED IDENTITY</strong>
      <span style={{ color: "rgba(255,255,255,.78)", flex: "1 1 380px" }}>
        No TideCloak adapter is configured on this deployment. Sign-in, roles and access
        checks are simulated so the flow can be reviewed end to end — there is no Tide
        cryptography, no ORK threshold and no QEA here. Nothing is sent to a bank, and the
        synthetic store may reset.
      </span>

      {authenticated && persona ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ color: "rgba(255,255,255,.9)" }}>
            Acting as <strong style={{ color: "#d8ff72" }}>{persona.givenName}</strong>
            <span style={{ color: "rgba(255,255,255,.55)" }}> · account:joint-owner</span>
          </span>
          <button
            type="button"
            onClick={login}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid rgba(216,255,114,.5)",
              background: "transparent",
              color: "#d8ff72",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Switch owner
          </button>
          <button
            type="button"
            onClick={logout}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: 0,
              background: "rgba(255,255,255,.12)",
              color: "rgba(255,255,255,.75)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </span>
      ) : (
        <span style={{ color: "rgba(255,255,255,.55)" }}>Not signed in</span>
      )}
    </div>
  );
}
