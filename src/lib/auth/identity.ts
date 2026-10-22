import type { JWTPayload } from "jose";

export function displayNameFromToken(jwt: JWTPayload) {
  const givenName = typeof jwt.given_name === "string" ? jwt.given_name.trim() : "";
  const familyName = typeof jwt.family_name === "string" ? jwt.family_name.trim() : "";
  const fullName = [givenName, familyName].filter(Boolean).join(" ");

  if (fullName) return fullName;
  return typeof jwt.preferred_username === "string" && jwt.preferred_username.trim()
    ? jwt.preferred_username.trim()
    : "Joint owner";
}
