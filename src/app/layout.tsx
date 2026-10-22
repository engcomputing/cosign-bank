import type { Metadata } from "next";
import { Providers } from "./providers";
import { SetupRequired } from "./setup-required";
import { tryLoadTideConfig } from "@/lib/auth/tidecloakConfig";
import "./globals.css";

// The TideCloak adapter JSON is deployment configuration: it is read from the
// CLIENT_ADAPTER environment variable or from data/tidecloak.json (gitignored).
// Neither is guaranteed to exist while `next build` runs, so render per request
// instead of freezing whatever config was present at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CoSign Bank",
  description: "Remote joint-account withdrawals protected by Tide policy signing",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolved on the server and handed to the client provider as a prop, so no
  // client bundle ever statically imports data/tidecloak.json.
  const { config, error } = tryLoadTideConfig();

  return (
    <html lang="en">
      <body>
        {config ? (
          <Providers config={config}>{children}</Providers>
        ) : (
          <SetupRequired message={error} />
        )}
      </body>
    </html>
  );
}
