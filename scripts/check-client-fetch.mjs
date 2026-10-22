import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboard = await readFile("src/app/dashboard/page.tsx", "utf8");
const withdrawalRoute = await readFile("src/app/api/withdrawals/route.ts", "utf8");
const faceProfileRoute = await readFile("src/app/api/face-profile/route.ts", "utf8");

test("Tide secureFetch receives absolute URLs for DPoP", () => {
  assert.match(dashboard, /new URL\(path, window\.location\.origin\)\.toString\(\)/);
  assert.doesNotMatch(dashboard, /secureFetch\(["']\//);
  assert.equal((dashboard.match(/secureFetch\(apiUrl\(/g) || []).length, 4);
});

test("liveness and face matching gate the approval", () => {
  assert.match(dashboard, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(dashboard, /FaceLandmarker\.createFromOptions/);
  assert.match(dashboard, /livenessRef\.current\?\.phase !== "passed"/);
  assert.match(dashboard, /captureFaceEmbeddings/);
  assert.match(dashboard, /Save face to my Tide account/);
  assert.match(dashboard, /Match face and approve/);
  assert.match(withdrawalRoute, /faceEmbeddings/);
  assert.match(faceProfileRoute, /Explicit consent is required/);
  assert.match(dashboard, /Created TensorFlow Lite XNNPACK delegate for CPU/);
  assert.match(dashboard, /Demo withdrawal successful/);
  assert.match(dashboard, /Withdrawal request cancelled/);
  assert.match(dashboard, /cancelled-face-mismatch/);
  assert.match(dashboard, /No real bank account was charged/);
  assert.doesNotMatch(dashboard, /body: JSON\.stringify\(\{ withdrawalId, faceMatched/);
});
