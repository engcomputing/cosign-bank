import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceLiveness,
  createLivenessState,
} from "../src/lib/liveness.ts";

function frame(atMs, overrides = {}) {
  return {
    atMs,
    faceCount: 1,
    blinkLeft: 0.05,
    blinkRight: 0.05,
    displayNoseRatio: 0.5,
    faceWidth: 0.4,
    ...overrides,
  };
}

function calibrate(direction = "left") {
  let state = createLivenessState(direction, 0);
  for (let index = 1; index <= 10; index += 1) {
    state = advanceLiveness(state, frame(index * 100));
  }
  assert.equal(state.phase, "blink");
  return state;
}

test("a static open-eye photo cannot complete the blink challenge", () => {
  let state = calibrate();
  for (let index = 11; index <= 80; index += 1) {
    state = advanceLiveness(state, frame(index * 100));
  }
  assert.equal(state.phase, "blink");

  state = advanceLiveness(state, frame(20_000));
  assert.equal(state.phase, "failed");
  assert.equal(state.failure, "TIMEOUT");
});

test("blink then randomized head turn completes the challenge", () => {
  let state = calibrate("left");
  state = advanceLiveness(state, frame(1_100));
  state = advanceLiveness(state, frame(1_200, { blinkLeft: 0.8, blinkRight: 0.82 }));
  state = advanceLiveness(state, frame(1_300, { blinkLeft: 0.84, blinkRight: 0.81 }));
  state = advanceLiveness(state, frame(1_400));
  state = advanceLiveness(state, frame(1_500));
  assert.equal(state.phase, "turn");

  state = advanceLiveness(state, frame(1_600, { displayNoseRatio: 0.43 }));
  state = advanceLiveness(state, frame(1_700, { displayNoseRatio: 0.42 }));
  state = advanceLiveness(state, frame(1_800, { displayNoseRatio: 0.41 }));
  assert.equal(state.phase, "passed");
});

test("multiple faces stop the approval attempt immediately", () => {
  const state = advanceLiveness(
    createLivenessState("right", 0),
    frame(100, { faceCount: 2 }),
  );
  assert.equal(state.phase, "failed");
  assert.equal(state.failure, "MULTIPLE_FACES");
});

test("starting with closed eyes is not counted as a blink", () => {
  let state = createLivenessState("right", 0);
  for (let index = 1; index <= 5; index += 1) {
    state = advanceLiveness(
      state,
      frame(index * 100, { blinkLeft: 0.8, blinkRight: 0.8 }),
    );
  }
  assert.equal(state.phase, "calibrating");
  assert.equal(state.calibrationSamples.length, 0);
});
