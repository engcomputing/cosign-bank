// Shown when the TideCloak adapter JSON cannot be resolved (no adapter env var
// and no data/tidecloak.json). Server component: it receives the failure message
// from the root layout and renders setup instructions instead of letting the app
// crash with an opaque 500.
export function SetupRequired({ message }: { message: string | null }) {
  return (
    <main className="center-screen" style={{ padding: 24 }}>
      <div className="panel" style={{ width: "min(760px, 100%)", padding: 40 }}>
        <span className="eyebrow">CoSign Bank</span>
        <h1 style={{ margin: "10px 0 14px", fontSize: 30, letterSpacing: "-.03em" }}>
          TideCloak is not configured
        </h1>
        <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
          The build works, but this deployment has no TideCloak adapter JSON, so sign-in
          cannot start. The adapter is environment-specific, which is why{" "}
          <code>data/tidecloak.json</code> is gitignored and never ships with a fresh
          checkout.
        </p>

        <p className="alert error" style={{ marginTop: 22 }}>
          {message}
        </p>

        <h2 style={{ margin: "26px 0 10px", fontSize: 16 }}>Hosted deployment (Vercel)</h2>
        <ol style={{ margin: 0, paddingLeft: 20, color: "var(--muted)", lineHeight: 1.7 }}>
          <li>
            On the machine that ran <code>npm run init</code>, run <code>npm run deploy:check</code>.
            It validates the adapter and prints the exact command to upload it.
          </li>
          <li>
            Add <code>CLIENT_ADAPTER</code> (or <code>CLIENT_ADAPTER_B64</code>, which avoids
            multi-line paste problems) under{" "}
            <strong>Settings → Environment Variables</strong> for <strong>Production</strong>{" "}
            and <strong>Preview</strong>.
          </li>
          <li>
            <strong>Redeploy.</strong> Environment variable changes are not picked up by
            existing deployments.
          </li>
        </ol>

        <p style={{ marginTop: 18, color: "var(--muted)", lineHeight: 1.6 }}>
          Important: the adapter exported by <code>npm run init</code> points at{" "}
          <code>http://localhost:8080</code>. A browser visiting this site cannot reach
          your machine, so a public deployment needs TideCloak on a public HTTPS URL
          (<code>TIDECLOAK_URL=https://… ./scripts/init-tidecloak.sh</code>). Otherwise
          run the demo locally.
        </p>

        <h2 style={{ margin: "26px 0 10px", fontSize: 16 }}>Local development</h2>
        <pre style={{ margin: 0, padding: 16, borderRadius: 12, background: "#f3f5f1", overflowX: "auto", fontSize: 12 }}>
          npm run init   # bootstraps TideCloak and writes data/tidecloak.json
        </pre>

        <p style={{ marginTop: 22, color: "var(--muted)", fontSize: 12 }}>
          The adapter is configuration, not a credential: it holds public client settings
          and the realm&apos;s public signing keys.
        </p>
      </div>
    </main>
  );
}
