"use client";

import { FACE_SAMPLE_COUNT } from "./face-identity";

async function createHumanRuntime() {
  const { Human } = await import("@vladmandic/human");
  const runtime = new Human({
    modelBasePath: new URL("/human/", window.location.origin).toString(),
    cacheSensitivity: 0,
    debug: false,
    warmup: "face",
    filter: { enabled: true, equalization: true },
    face: {
      enabled: true,
      detector: {
        rotation: true,
        maxDetected: 2,
        minConfidence: 0.6,
        minSize: 160,
        skipFrames: 0,
        skipTime: 0,
      },
      mesh: { enabled: true },
      description: { enabled: true, minConfidence: 0.6, skipFrames: 0, skipTime: 0 },
      iris: { enabled: false },
      emotion: { enabled: false },
      antispoof: { enabled: false },
      liveness: { enabled: false },
    },
    body: { enabled: false },
    hand: { enabled: false },
    object: { enabled: false },
    gesture: { enabled: false },
  });
  await runtime.load();
  await runtime.warmup();
  return runtime;
}

let runtimePromise: ReturnType<typeof createHumanRuntime> | null = null;

function getHumanRuntime() {
  runtimePromise ??= createHumanRuntime();
  return runtimePromise;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export async function captureFaceEmbeddings(
  video: HTMLVideoElement,
  onProgress?: (captured: number, total: number) => void,
) {
  const runtime = await getHumanRuntime();
  const embeddings: number[][] = [];
  for (let index = 0; index < FACE_SAMPLE_COUNT; index += 1) {
    const result = await runtime.detect(video);
    if (result.face.length !== 1) {
      throw new Error("Keep exactly one face in the camera while identity samples are captured.");
    }
    const embedding = result.face[0].embedding;
    if (!embedding || embedding.length === 0) {
      throw new Error("The face identity model could not create an embedding. Look straight at the camera.");
    }
    embeddings.push([...embedding]);
    onProgress?.(embeddings.length, FACE_SAMPLE_COUNT);
    if (index < FACE_SAMPLE_COUNT - 1) await wait(220);
  }
  return embeddings;
}
