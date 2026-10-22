import { withRole } from "@/lib/auth/protect";
import { displayNameFromToken } from "@/lib/auth/identity";
import { FaceIdentityError } from "@/lib/face-identity";
import { enrollFaceProfile, getFaceProfileStatus } from "@/lib/face-profile-store";

export const dynamic = "force-dynamic";

type EnrollmentBody = {
  consent?: unknown;
  embeddings?: unknown;
};

export const GET = withRole("account:joint-owner", async (_request, jwt) => {
  if (!jwt.sub) {
    return Response.json({ error: "Verified Tide token has no subject" }, { status: 400 });
  }
  return Response.json(await getFaceProfileStatus(jwt.sub), {
    headers: { "Cache-Control": "no-store" },
  });
});

export const PUT = withRole("account:joint-owner", async (request, jwt) => {
  if (!jwt.sub) {
    return Response.json({ error: "Verified Tide token has no subject" }, { status: 400 });
  }
  try {
    const body = (await request.json()) as EnrollmentBody;
    if (body.consent !== true) {
      return Response.json(
        { error: "Explicit consent is required before saving a biometric face template" },
        { status: 400 },
      );
    }
    const profile = await enrollFaceProfile(
      jwt.sub,
      displayNameFromToken(jwt),
      body.embeddings,
    );
    return Response.json({
      enrolled: true,
      enrolledAt: profile.enrolledAt,
      sampleCount: profile.embeddings.length,
      model: profile.model,
      notice: "Face profile enrolled for this verified Tide account. No image or video was saved.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not enroll face profile";
    return Response.json(
      { error: message },
      { status: error instanceof FaceIdentityError ? 400 : 500 },
    );
  }
});
