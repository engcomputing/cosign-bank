import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  FACE_MODEL_ID,
  type FaceProfile,
  FaceIdentityError,
  matchFaceProfile,
  validateFaceSamples,
} from "./face-identity";

const dataDirectory = path.join(process.cwd(), "data");
const profilePath = path.join(dataDirectory, "face-profiles.json");
let profileUpdateQueue: Promise<unknown> = Promise.resolve();

export async function readFaceProfiles(): Promise<FaceProfile[]> {
  try {
    const raw = await readFile(profilePath, "utf8");
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) {
      throw new FaceIdentityError("INVALID_FACE_DATA", "Stored face profile data is invalid");
    }
    return value.map((entry) => {
      if (
        typeof entry !== "object" ||
        entry === null ||
        typeof (entry as FaceProfile).subject !== "string" ||
        typeof (entry as FaceProfile).displayName !== "string" ||
        typeof (entry as FaceProfile).enrolledAt !== "string" ||
        (entry as FaceProfile).model !== FACE_MODEL_ID
      ) {
        throw new FaceIdentityError("INVALID_FACE_DATA", "Stored face profile metadata is invalid");
      }
      return {
        ...(entry as FaceProfile),
        embeddings: validateFaceSamples((entry as FaceProfile).embeddings),
      };
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function enrollFaceProfile(
  subject: string,
  displayName: string,
  samplesValue: unknown,
) {
  const embeddings = validateFaceSamples(samplesValue);
  const update = profileUpdateQueue.then(async () => {
    const profiles = await readFaceProfiles();
    const profile: FaceProfile = {
      subject,
      displayName,
      model: FACE_MODEL_ID,
      embeddings,
      enrolledAt: new Date().toISOString(),
    };
    const existingIndex = profiles.findIndex((entry) => entry.subject === subject);
    if (existingIndex >= 0) profiles[existingIndex] = profile;
    else profiles.push(profile);
    await mkdir(dataDirectory, { recursive: true });
    const temporaryPath = `${profilePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(profiles, null, 2)}\n`, "utf8");
    await rename(temporaryPath, profilePath);
    return profile;
  });
  profileUpdateQueue = update.then(
    () => undefined,
    () => undefined,
  );
  return update;
}

export async function getFaceProfileStatus(subject: string) {
  const profiles = await readFaceProfiles();
  const profile = profiles.find((entry) => entry.subject === subject);
  return profile
    ? {
        enrolled: true as const,
        enrolledAt: profile.enrolledAt,
        sampleCount: profile.embeddings.length,
        model: profile.model,
      }
    : {
        enrolled: false as const,
        enrolledAt: null,
        sampleCount: 0,
        model: FACE_MODEL_ID,
      };
}

export async function verifyFaceProfile(subject: string, samplesValue: unknown) {
  const profiles = await readFaceProfiles();
  return matchFaceProfile(subject, profiles, samplesValue);
}
