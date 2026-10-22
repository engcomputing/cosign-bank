export const FACE_MODEL_ID = "human-faceres-3.3.6";
export const FACE_EMBEDDING_LENGTH = 1024;
export const FACE_SAMPLE_COUNT = 3;
export const FACE_MATCH_THRESHOLD = 0.6;
export const FACE_MATCH_MARGIN = 0.04;

export type FaceProfile = {
  subject: string;
  displayName: string;
  model: typeof FACE_MODEL_ID;
  embeddings: number[][];
  enrolledAt: string;
};

export class FaceIdentityError extends Error {
  public readonly code:
    | "FACE_NOT_ENROLLED"
    | "FACE_MISMATCH"
    | "INVALID_FACE_DATA";

  constructor(
    code: "FACE_NOT_ENROLLED" | "FACE_MISMATCH" | "INVALID_FACE_DATA",
    message: string,
  ) {
    super(message);
    this.name = "FaceIdentityError";
    this.code = code;
  }
}

function validateEmbedding(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== FACE_EMBEDDING_LENGTH) {
    throw new FaceIdentityError("INVALID_FACE_DATA", "Face embedding has an invalid length");
  }
  const embedding = value.map(Number);
  if (embedding.some((entry) => !Number.isFinite(entry) || Math.abs(entry) > 1_000)) {
    throw new FaceIdentityError("INVALID_FACE_DATA", "Face embedding contains invalid values");
  }
  return embedding;
}

export function validateFaceSamples(value: unknown, exactCount = FACE_SAMPLE_COUNT): number[][] {
  if (!Array.isArray(value) || value.length !== exactCount) {
    throw new FaceIdentityError(
      "INVALID_FACE_DATA",
      `Exactly ${exactCount} face samples are required`,
    );
  }
  return value.map(validateEmbedding);
}

export function faceSimilarity(left: number[], right: number[]) {
  if (left.length !== right.length || left.length !== FACE_EMBEDDING_LENGTH) return 0;
  let squaredDifference = 0;
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index] - right[index];
    squaredDifference += difference * difference;
  }
  const distance = 25 * squaredDifference;
  if (distance === 0) return 1;
  const normalized = (1 - Math.sqrt(distance) / 100 - 0.2) / 0.6;
  return Math.max(0, Math.min(1, normalized));
}

function profileScore(referenceSamples: number[][], liveSamples: number[][]) {
  const scores = liveSamples.map((liveSample) =>
    Math.max(...referenceSamples.map((reference) => faceSimilarity(reference, liveSample))),
  );
  return scores.reduce((total, score) => total + score, 0) / scores.length;
}

export function matchFaceProfile(
  subject: string,
  profiles: FaceProfile[],
  liveSamplesValue: unknown,
) {
  const liveSamples = validateFaceSamples(liveSamplesValue);
  const target = profiles.find((profile) => profile.subject === subject);
  if (!target) {
    throw new FaceIdentityError(
      "FACE_NOT_ENROLLED",
      "Enroll a face profile for this Tide account before approving",
    );
  }

  const targetScore = profileScore(target.embeddings, liveSamples);
  const otherScores = profiles
    .filter((profile) => profile.subject !== subject)
    .map((profile) => profileScore(profile.embeddings, liveSamples));
  const closestOtherScore = otherScores.length > 0 ? Math.max(...otherScores) : 0;
  const matched =
    targetScore >= FACE_MATCH_THRESHOLD &&
    (otherScores.length === 0 || targetScore >= closestOtherScore + FACE_MATCH_MARGIN);

  if (!matched) {
    throw new FaceIdentityError(
      "FACE_MISMATCH",
      "Face does not match the profile enrolled for this Tide account. Approval cancelled.",
    );
  }

  return {
    similarity: Math.round(targetScore * 1_000) / 1_000,
    closestOtherSimilarity: Math.round(closestOtherScore * 1_000) / 1_000,
  };
}
