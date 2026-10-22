import type { DeploymentDiagnostic } from "@/lib/auth/tidecloakConfig";

// Shown when the TideCloak adapter JSON cannot be resolved (no adapter env var
// and no data/tidecloak.json). Server component: it receives the failure message
// and a deployment diagnostic from the root layout, so an operator can see
// exactly why *this* deployment does not have the configuration.
const STATUS_COLORS: Record<string, { fg: string; bg: string }> = {
  valid: { fg: "#0b513e", bg: "#e5f8ef" },
  absent: { fg: "#8e2f25", bg: "#ffe0d8" },
  empty: { fg: "#8e2f25", bg: "#ffe0d8" },
  invalid: { fg: "#8e2f25", bg: "#ffe0d8" },
};

export function SetupRequired({
  message,
  diagnostic,
}: {
  message: string | null;
  diagnostic?: DeploymentDiagnostic;
}) {
  const anySourcePresent =
    diagnostic?.sources.some((source) => source.present) || diagnostic?.file.present;

  return (
    <main className="center-screen" style={{ padding: 24 }}>
      <div className="panel" style={{ width: "min(820px, 100%)", padding: 40 }}>
        <span className="eyebrow">CoSign Bank</span>
        <h1 style={{ margin: "10px 0 14px", fontSize: 30, letterSpacing: "-.03em" }}>
          TideCloak is not configured
        </h1>
        <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
          The build works, but this deployment has no usable TideCloak adapter JSON, so
          sign-in cannot start. The adapter is environment-specific, which is why{" "}
          <code>data/tidecloak.json</code> is gitignored and never ships with a fresh
          checkout.
        </p>

        <p className="alert error" style={{ marginTop: 22 }}>
          {message}
        </p>

        {diagnostic && (
          <>
            <h2 style={{ margin: "26px 0 10px", fontSize: 16 }}>
              What this deployment can see
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <tbody>
                <Row label="Host" value={diagnostic.platform.name} />
                <Row label="Environment" value={diagnostic.platform.environment ?? "unknown"} />
                {diagnostic.platform.projectId && (
                  <Row label="Vercel project ID" value={diagnostic.platform.projectId} />
                )}
                {diagnostic.platform.url && (
                  <Row label="Deployment URL" value={diagnostic.platform.url} />
                )}
                {diagnostic.platform.branch && (
                  <Row label="Branch" value={diagnostic.platform.branch} />
                )}
                {diagnostic.platform.commitSha && (
                  <Row label="Commit" value={diagnostic.platform.commitSha.slice(0, 12)} />
                )}
                {diagnostic.sources.map((source) => (
                  <Row
                    key={source.key}
                    label={source.key}
                    value={
                      source.status === "absent"
                        ? "not set"
                        : `${source.status}${source.length !== undefined ? ` (${source.length} chars)` : ""}`
                    }
                    tone={source.status === "valid" ? "ok" : "bad"}
                    detail={source.detail}
                  />
                ))}
                <Row
                  label="data/tidecloak.json"
                  value={diagnostic.file.status}
                  tone={diagnostic.file.status === "valid" ? "ok" : "bad"}
                />
              </tbody>
            </table>

            <p style={{ margin: "16px 0 0", color: "var(--muted)", lineHeight: 1.6, fontSize: 13 }}>
              {anySourcePresent ? (
                <>
                  A variable <em>is</em> present but this deployment cannot use it — check
                  the status above. Values set in one Vercel environment (for example
                  <strong> Development</strong>) are not injected into another (for example
                  <strong> Production</strong>), and an existing deployment never picks up a
                  new variable: redeploy after changing it.
                </>
              ) : (
                <>
                  No adapter variable reached this deployment. If you added one in the
                  dashboard, confirm it is on <strong>the same Vercel project as this URL</strong>{" "}
                  (compare the project ID above), scoped to the{" "}
                  <strong>{diagnostic.platform.environment ?? "matching"}</strong> environment,
                  and that you redeployed afterwards. Note that Vercel does not pass project
                  environment variables to deployments built from forks.
                </>
              )}
            </p>
          </>
        )}

        <h2 style={{ margin: "26px 0 10px", fontSize: 16 }}>One command (recommended)</h2>
        <p style={{ margin: "0 0 8px", color: "var(--muted)", lineHeight: 1.6 }}>
          On the machine that ran <code>npm run init</code>:
        </p>
        <pre style={{ margin: 0, padding: 16, borderRadius: 12, background: "#f3f5f1", overflowX: "auto", fontSize: 12 }}>
          npm run deploy
        </pre>
        <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 12 }}>
          Validates the adapter, uploads it to Production, Preview and Development, then
          deploys. Needs your own <code>vercel login</code>.
        </p>

        <h2 style={{ margin: "26px 0 10px", fontSize: 16 }}>Manual alternative</h2>
        <ol style={{ margin: 0, paddingLeft: 20, color: "var(--muted)", lineHeight: 1.7 }}>
          <li>
            Run <code>npm run deploy:check</code> — it prints ready-to-paste{" "}
            <code>vercel env add</code> commands.
          </li>
          <li>
            Or add <code>CLIENT_ADAPTER</code> (or <code>CLIENT_ADAPTER_B64</code>) under{" "}
            <strong>Settings → Environment Variables</strong> for <strong>Production</strong>{" "}
            and <strong>Preview</strong>.
          </li>
          <li>
            <strong>Redeploy</strong> — environment variable changes are not applied to
            existing deployments.
          </li>
        </ol>

        <p style={{ marginTop: 18, color: "var(--muted)", lineHeight: 1.6 }}>
          Important: the adapter exported by <code>npm run init</code> points at{" "}
          <code>http://localhost:8080</code>. A browser visiting this site cannot reach your
          machine, so a public deployment also needs TideCloak on a public HTTPS URL
          (<code>TIDECLOAK_URL=https://… ./scripts/init-tidecloak.sh</code>). Otherwise run
          the demo locally.
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

function Row({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad";
  detail?: string;
}) {
  const colors = tone ? STATUS_COLORS[tone === "ok" ? "valid" : "absent"] : undefined;
  return (
    <tr>
      <td
        style={{
          padding: "7px 10px 7px 0",
          borderBottom: "1px solid var(--line)",
          color: "var(--muted)",
          whiteSpace: "nowrap",
          verticalAlign: "top",
        }}
      >
        {label}
      </td>
      <td style={{ padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
        <code
          style={{
            padding: colors ? "2px 8px" : 0,
            borderRadius: 999,
            color: colors?.fg,
            background: colors?.bg,
            fontSize: 11,
          }}
        >
          {value}
        </code>
        {detail && (
          <div style={{ marginTop: 4, color: "var(--muted)", fontSize: 11 }}>{detail}</div>
        )}
      </td>
    </tr>
  );
}
