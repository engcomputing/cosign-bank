import { DEMO_PERSONAS, findPersona, signDemoToken } from "@/lib/auth/demo-identity";
import { authMode } from "@/lib/auth/authMode";

export const dynamic = "force-dynamic";

// Simulated TideCloak login endpoint.
//
// It exists only while `authMode()` is "simulated". As soon as a real adapter is
// configured this returns 404, so a deployment can never quietly accept demo
// credentials alongside TideCloak.
export async function GET() {
  if (authMode() !== "simulated") {
    return Response.json({ error: "Simulated identity is not enabled" }, { status: 404 });
  }
  return Response.json({
    authMode: "simulated",
    notice:
      "Simulated identity for demo purposes. Tokens are signed with a public constant and " +
      "are not Tide credentials.",
    personas: DEMO_PERSONAS.map(({ id, subject, username, givenName, email, ownerId, title }) => ({
      id,
      subject,
      username,
      givenName,
      email,
      ownerId,
      title,
    })),
  });
}

export async function POST(request: Request) {
  if (authMode() !== "simulated") {
    return Response.json({ error: "Simulated identity is not enabled" }, { status: 404 });
  }

  let personaId: unknown;
  try {
    const body = (await request.json()) as { personaId?: unknown };
    personaId = body.personaId;
  } catch {
    return Response.json({ error: "Expected a JSON body with personaId" }, { status: 400 });
  }

  if (typeof personaId !== "string") {
    return Response.json({ error: "personaId is required" }, { status: 400 });
  }

  const persona = findPersona(personaId);
  if (!persona) {
    return Response.json({ error: "Unknown persona" }, { status: 400 });
  }

  const token = await signDemoToken(persona);
  return Response.json(
    {
      token,
      authMode: "simulated",
      persona: {
        id: persona.id,
        subject: persona.subject,
        username: persona.username,
        givenName: persona.givenName,
        email: persona.email,
        ownerId: persona.ownerId,
        title: persona.title,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
