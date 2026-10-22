// Shown when the TideCloak adapter JSON cannot be resolved (no CLIENT_ADAPTER
// env var and no data/tidecloak.json). Server component: it receives the
// failure message from the root layout and renders setup instructions instead
// of letting the app crash with an opaque 500.
export function SetupRequired({ message }: { message: string | null }) {
  return (
    <main className="center-screen" style={{ padding: 24 }}>
      <div className="panel" style={{ width: "min(720px, 100%)", padding: 40 }}>
        <span className="eyebrow">CoSign Bank</span>
        <h1 style={{ margin: "10px 0 14px", fontSize: 30, letterSpacing: "-.03em" }}>
          TideCloak is not configured
        </h1>
        <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
          This deployment has no TideCloak adapter JSON, so sign-in cannot start. The
          adapter is environment-specific, which is why <code>data/tidecloak.json</code> is
          gitignored and never ships with a fresh checkout.
        </p>

        <p className="alert error" style={{ marginTop: 22 }}>
          {message}
        </p>

        <h2 style={{ margin: "26px 0 10px", fontSize: 16 }}>Local development</h2>
        <pre style={{ margin: 0, padding: 16, borderRadius: 12, background: "#f3f5f1", overflowX: "auto", fontSize: 12 }}>
          npm run init   # bootstraps TideCloak and writes data/tidecloak.json
        </pre>

        <h2 style={{ margin: "26px 0 10px", fontSize: 16 }}>Vercel or any other host</h2>
        <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
          Take the adapter JSON exported by <code>npm run init</code> and set it as the{" "}
          <code>CLIENT_ADAPTER</code> environment variable (Project → Settings →
          Environment Variables), then redeploy. It must be a single-line JSON object.
        </p>

        <p style={{ marginTop: 22, color: "var(--muted)", fontSize: 12 }}>
          This is configuration, not a secret: the adapter holds public client settings and
          the realm&apos;s public signing keys.
        </p>
      </div>
    </main>
  );
}
