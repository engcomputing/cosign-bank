// Banner for non-fatal configuration problems that still break sign-in — most
// often an adapter pointing at http://localhost:8080 while the app is served
// from a real hostname. Server component: the warnings are computed in the root
// layout, so nothing is evaluated in the browser.
export function ConfigWarnings({ warnings }: { warnings: string[] }) {
  return (
    <div
      role="alert"
      style={{
        padding: "14px 20px",
        background: "#fff3d1",
        borderBottom: "1px solid #e8d9a8",
        color: "#5b4518",
        fontSize: 13,
        lineHeight: 1.55,
      }}
    >
      <strong style={{ display: "block", marginBottom: 6 }}>
        TideCloak adapter loaded, but sign-in will not work here
      </strong>
      {warnings.map((warning) => (
        <p key={warning} style={{ margin: "6px 0 0" }}>
          {warning}
        </p>
      ))}
    </div>
  );
}
