import { withRole } from "@/lib/auth/protect";
import { displayNameFromToken } from "@/lib/auth/identity";
import { readBankDatabase } from "@/lib/demo-db";
import { getFaceProfileStatus } from "@/lib/face-profile-store";

export const dynamic = "force-dynamic";

export const GET = withRole("account:joint-owner", async (_request, jwt) => {
  if (!jwt.sub) {
    return Response.json({ error: "Verified Tide token has no subject" }, { status: 400 });
  }
  const database = await readBankDatabase();
  const faceProfile = await getFaceProfileStatus(jwt.sub);
  const withdrawalRequests = database.withdrawalRequests.map(
    ({ requestedBySubject, approvals, ...withdrawal }) => ({
      ...withdrawal,
      approvals: approvals.map(({ subject, ...approval }) => ({
        ...approval,
        isCurrentUser: subject === jwt.sub,
      })),
      viewer: {
        isRequester: requestedBySubject === jwt.sub,
        hasApproved: approvals.some((approval) => approval.subject === jwt.sub),
      },
    }),
  );
  return Response.json(
    {
      account: database.account,
      recentActivity: database.recentActivity,
      withdrawalRequests,
      session: {
        verifiedSubject: jwt.sub,
        displayName: displayNameFromToken(jwt),
      },
      faceProfile,
      security: {
        tideLogin: "verified-server-side",
        dpop: "strict",
        applicationApproval: "server-enforced-demo",
        signingPolicy: "requires-tide-team-deployment",
        biometricLiveness: "client-camera-challenge",
        faceIdentity: faceProfile.enrolled ? "server-matched-embedding-demo" : "enrollment-required",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});
