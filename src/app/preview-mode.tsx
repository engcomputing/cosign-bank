import type { DeploymentDiagnostic } from "@/lib/auth/tidecloakConfig";
import { SetupRequired } from "./setup-required";

// Preview mode.
//
// Rendered instead of the app when no TideCloak adapter resolves. It shows the
// real interface so a reviewer landing on the URL sees the product rather than a
// stack trace, and it is explicit about three things: authentication is not
// configured, the interactive parts are disabled, and no money moves. Nothing
// here simulates a signed-in session — there is no fake provider, no seeded
// "authenticated" state, and the sign-in controls are genuinely disabled.
export function PreviewMode({
  message,
  diagnostic,
}: {
  message: string | null;
  diagnostic: DeploymentDiagnostic;
}) {
  const configuredEnvironment = diagnostic.platform.environment ?? "this environment";

  return (
    <main>
      <div
        role="status"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "10px 16px",
          padding: "12px 24px",
          background: "#fff3d1",
          borderBottom: "1px solid #e8d9a8",
          color: "#5b4518",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        <strong>Preview mode</strong>
        <span>
          TideCloak is not configured and the simulated identity is disabled (DEMO_AUTH=0),
          so sign-in and the approval dashboard are unavailable. Layout and copy are real; no
          account, approval or transfer runs here.
        </span>
        <a href="#configuration" style={{ marginLeft: "auto", fontWeight: 800, color: "#5b4518" }}>
          How to enable sign-in →
        </a>
      </div>

      <nav className="topbar">
        <a className="brand" href="#">
          <span className="brand-mark">C</span>
          <span>CoSign Bank</span>
        </a>
        <div className="nav-actions">
          <span className="nav-label">Joint account security</span>
          <button
            className="button dark small"
            type="button"
            disabled
            aria-disabled="true"
            title="TideCloak is not configured and the simulator is disabled (DEMO_AUTH=0)"
            style={{ opacity: 0.5, cursor: "not-allowed" }}
          >
            Secure sign in
          </button>
        </div>
      </nav>

      <section className="bank-hero">
        <div className="bank-hero-copy">
          <span className="eyebrow light">RMIT Hackathon 2026 · Challenge 2</span>
          <h1>
            Joint withdrawals.
            <br />
            No branch visit.
          </h1>
          <p>
            One owner requests. Two other co-owners approve remotely. Tide policy signing is
            designed to refuse the transaction unless every security condition passes.
          </p>
          <div className="hero-actions">
            <button
              className="button lime"
              type="button"
              disabled
              aria-disabled="true"
              title="Sign-in needs a configured TideCloak adapter"
              style={{ opacity: 0.55, cursor: "not-allowed" }}
            >
              Sign in with Tide <span>→</span>
            </button>
            <a className="button glass" href="#security">
              See security model
            </a>
          </div>
          <p className="welcome-line">
            Sign-in is unavailable in {configuredEnvironment} until this deployment is
            configured.
          </p>
        </div>

        <div className="phone-stage" aria-label="Joint withdrawal approval preview">
          <div className="phone-card phone-back">
            <span className="phone-kicker">Approval request</span>
            <strong>₫25,000,000</strong>
            <p>Future Fund · •••• 2048</p>
            <div className="face-check">
              <span>LT</span>
              <div>
                <b>Linh</b>
                <small>Independent approval</small>
              </div>
              <em>Waiting</em>
            </div>
            <div className="face-check">
              <span>AP</span>
              <div>
                <b>An</b>
                <small>Independent approval</small>
              </div>
              <em>Waiting</em>
            </div>
          </div>
          <div className="phone-card phone-front">
            <div className="phone-status">
              <span>9:41</span>
              <span>Secure</span>
            </div>
            <div className="mini-brand">
              <span>C</span> CoSign
            </div>
            <p className="phone-label">Available balance</p>
            <strong className="phone-balance">₫240,000,000</strong>
            <div className="owner-stack">
              <span>MN</span>
              <span>LT</span>
              <span>AP</span>
              <small>3 co-owners</small>
            </div>
            <div className="withdraw-card">
              <span>New withdrawal</span>
              <b>2 approvals required</b>
              <small>Requester cannot self-approve</small>
            </div>
          </div>
        </div>
      </section>

      <section className="trust-row" id="security">
        <article>
          <span>01</span>
          <div>
            <strong>Verified identity</strong>
            <p>Real TideCloak OIDC login with strict DPoP token binding.</p>
          </div>
        </article>
        <article>
          <span>02</span>
          <div>
            <strong>Two independent owners</strong>
            <p>Proposed Forseti policy excludes the requester and requires two distinct VUIDs.</p>
          </div>
        </article>
        <article>
          <span>03</span>
          <div>
            <strong>Threshold signature</strong>
            <p>Once deployed, ORKs sign only when the contract permits the exact withdrawal payload.</p>
          </div>
        </article>
      </section>

      <section className="honesty-section">
        <div>
          <span className="eyebrow">Prototype boundary</span>
          <h2>Security claims you can verify.</h2>
        </div>
        <div className="boundary-grid">
          <article className="boundary-card real">
            <span>Live now</span>
            <h3>Tide login, JWT and DPoP</h3>
            <p>
              The server rejects missing, invalid or replayable credentials. Browser-supplied
              roles are ignored.
            </p>
          </article>
          <article className="boundary-card prepared">
            <span>Prepared</span>
            <h3>2-of-3 withdrawal contract</h3>
            <p>
              The contract source and local policy tests are included. Tide team deployment is
              still required.
            </p>
          </article>
          <article className="boundary-card pending">
            <span>Not running here</span>
            <h3>Approvals in this deployment</h3>
            <p>
              This instance has no identity provider configured, so the approval flow is
              disabled rather than simulated.
            </p>
          </article>
        </div>
      </section>

      <SetupRequired message={message} diagnostic={diagnostic} />

      <footer className="footer">
        <span>CoSign Bank · Synthetic money only</span>
        <span>Built with TideCloak</span>
      </footer>
    </main>
  );
}
