import type { Metadata } from "next";
import { headers } from "next/headers";
import { Providers } from "./providers";
import { SetupRequired } from "./setup-required";
import { ConfigWarnings } from "./config-warnings";
import { tryLoadTideConfig, adapterDiagnostics } from "@/lib/auth/tidecloakConfig";
import "./globals.css";

// The TideCloak adapter JSON is deployment configuration: it is read from an
// environment variable (CLIENT_ADAPTER / CLIENT_ADAPTER_B64) or from
// data/tidecloak.json (gitignored). Neither is guaranteed to exist while
// `next build` runs, so render per request instead of freezing whatever config
// was present at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CoSign Bank",
  description: "Remote joint-account withdrawals protected by Tide policy signing",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolved on the server and handed to the client provider as a prop, so no
  // client bundle ever statically imports data/tidecloak.json.
  // The request hostname decides whether a localhost auth-server-url is a
  // broken deployment or simply local development.
  const host = (await headers()).get("host");
  const { config, error, warnings } = tryLoadTideConfig(host);

  return (
    <html lang="en">
      <body>
        {config ? (
          <Providers config={config}>
            {warnings.length > 0 && <ConfigWarnings warnings={warnings} />}
            {children}
          </Providers>
        ) : (
          <SetupRequired message={error} diagnostic={adapterDiagnostics()} />
        )}
      </body>
    </html>
  );
}
