import assert from "node:assert/strict";
import test from "node:test";
import {
  FACE_EMBEDDING_LENGTH,
  FACE_MODEL_ID,
  FaceIdentityError,
  matchFaceProfile,
  validateFaceSamples,
} from "../src/lib/face-identity.ts";

const sample = (value) => Array.from({ length: FACE_EMBEDDING_LENGTH }, () => value);
const profile = (subject, value) => ({
  subject,
  displayName: subject,
  model: FACE_MODEL_ID,
  embeddings: [sample(value), sample(value), sample(value)],
  enrolledAt: "2026-10-22T00:00:00.000Z",
});

test("face samples require three finite 1024-value embeddings", () => {
  assert.equal(validateFaceSamples([sample(0), sample(0), sample(0)]).length, 3);
  assert.throws(
    () => validateFaceSamples([sample(0)]),
    (error) => error instanceof FaceIdentityError && error.code === "INVALID_FACE_DATA",
  );
});

test("the enrolled Tide subject accepts its own closest face", () => {
  const result = matchFaceProfile("founder-b", [profile("founder-b", 0), profile("founder-c", 0.5)], [
    sample(0.01),
    sample(0.01),
    sample(0.01),
  ]);
  assert.ok(result.similarity >= 0.6);
});

test("a different enrolled founder is rejected", () => {
  assert.throws(
    () =>
      matchFaceProfile("founder-b", [profile("founder-b", 0), profile("founder-c", 0.5)], [
        sample(0.5),
        sample(0.5),
        sample(0.5),
      ]),
    (error) => error instanceof FaceIdentityError && error.code === "FACE_MISMATCH",
  );
});

test("approval fails when the Tide account has no enrolled face", () => {
  assert.throws(
    () => matchFaceProfile("founder-b", [], [sample(0), sample(0), sample(0)]),
    (error) => error instanceof FaceIdentityError && error.code === "FACE_NOT_ENROLLED",
  );
});
