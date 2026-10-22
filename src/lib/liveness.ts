export type LivenessDirection = "left" | "right";

export type LivenessPhase =
  | "calibrating"
  | "blink"
  | "turn"
  | "passed"
  | "failed";

export type LivenessFailure = "TIMEOUT" | "MULTIPLE_FACES";

export type LivenessObservation = {
  atMs: number;
  faceCount: number;
  blinkLeft: number;
  blinkRight: number;
  displayNoseRatio: number | null;
  faceWidth: number | null;
};

export type LivenessState = {
  phase: LivenessPhase;
  direction: LivenessDirection;
  expiresAtMs: number;
  calibrationSamples: number[];
  baselineNoseRatio: number | null;
  eyesOpenSeen: boolean;
  blinkClosedFrames: number;
  blinkReopenFrames: number;
  turnFrames: number;
  feedback: string;
  failure: LivenessFailure | null;
};

const CALIBRATION_FRAMES = 10;
const CLOSED_FRAMES = 2;
const REOPEN_FRAMES = 2;
const TURN_FRAMES = 3;
const TURN_DELTA = 0.055;
const CHALLENGE_DURATION_MS = 20_000;

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function createLivenessState(
  direction: LivenessDirection,
  startedAtMs = Date.now(),
): LivenessState {
  return {
    phase: "calibrating",
    direction,
    expiresAtMs: startedAtMs + CHALLENGE_DURATION_MS,
    calibrationSamples: [],
    baselineNoseRatio: null,
    eyesOpenSeen: false,
    blinkClosedFrames: 0,
    blinkReopenFrames: 0,
    turnFrames: 0,
    feedback: "Look straight at the camera",
    failure: null,
  };
}

function fail(state: LivenessState, failure: LivenessFailure, feedback: string): LivenessState {
  return { ...state, phase: "failed", failure, feedback };
}

export function advanceLiveness(
  state: LivenessState,
  observation: LivenessObservation,
): LivenessState {
  if (state.phase === "passed" || state.phase === "failed") return state;

  if (observation.faceCount > 1) {
    return fail(state, "MULTIPLE_FACES", "Multiple faces detected. Approval was not sent.");
  }

  if (observation.atMs >= state.expiresAtMs) {
    return fail(state, "TIMEOUT", "Movement challenge timed out. Approval was not sent.");
  }

  if (
    observation.faceCount !== 1 ||
    observation.displayNoseRatio === null ||
    observation.faceWidth === null
  ) {
    return {
      ...state,
      blinkClosedFrames: 0,
      blinkReopenFrames: 0,
      turnFrames: 0,
      feedback: "No single face detected",
    };
  }

  if (observation.faceWidth < 0.18) {
    return { ...state, feedback: "Move closer to the camera" };
  }

  if (observation.faceWidth > 0.72) {
    return { ...state, feedback: "Move slightly away from the camera" };
  }

  const eyesOpen = observation.blinkLeft < 0.3 && observation.blinkRight < 0.3;
  const eyesClosed = observation.blinkLeft > 0.55 && observation.blinkRight > 0.55;

  if (state.phase === "calibrating") {
    if (!eyesOpen) {
      return { ...state, feedback: "Keep both eyes open and look straight" };
    }

    const calibrationSamples = [...state.calibrationSamples, observation.displayNoseRatio];
    if (calibrationSamples.length < CALIBRATION_FRAMES) {
      return {
        ...state,
        calibrationSamples,
        feedback: `Calibrating face position · ${calibrationSamples.length}/${CALIBRATION_FRAMES}`,
      };
    }

    return {
      ...state,
      phase: "blink",
      calibrationSamples,
      baselineNoseRatio: median(calibrationSamples),
      eyesOpenSeen: true,
      feedback: "Blink both eyes once",
    };
  }

  if (state.phase === "blink") {
    if (!state.eyesOpenSeen && eyesOpen) {
      return { ...state, eyesOpenSeen: true, feedback: "Now blink both eyes" };
    }

    if (state.eyesOpenSeen && eyesClosed) {
      const blinkClosedFrames = state.blinkClosedFrames + 1;
      return {
        ...state,
        blinkClosedFrames,
        feedback: blinkClosedFrames >= CLOSED_FRAMES ? "Open your eyes" : "Hold the blink briefly",
      };
    }

    if (state.blinkClosedFrames >= CLOSED_FRAMES && eyesOpen) {
      const blinkReopenFrames = state.blinkReopenFrames + 1;
      if (blinkReopenFrames >= REOPEN_FRAMES) {
        return {
          ...state,
          phase: "turn",
          blinkReopenFrames,
          feedback: `Turn your head toward the ${state.direction} arrow`,
        };
      }
      return { ...state, blinkReopenFrames, feedback: "Keep your eyes open" };
    }

    return {
      ...state,
      blinkClosedFrames: state.blinkClosedFrames >= CLOSED_FRAMES ? state.blinkClosedFrames : 0,
      blinkReopenFrames: 0,
      feedback: "Blink both eyes once",
    };
  }

  const baseline = state.baselineNoseRatio ?? 0.5;
  const delta = observation.displayNoseRatio - baseline;
  const turnedFarEnough = state.direction === "left" ? delta <= -TURN_DELTA : delta >= TURN_DELTA;
  const turnFrames = turnedFarEnough ? state.turnFrames + 1 : 0;

  if (turnFrames >= TURN_FRAMES) {
    return {
      ...state,
      phase: "passed",
      turnFrames,
      feedback: "Live movement challenge passed",
    };
  }

  return {
    ...state,
    turnFrames,
    feedback: `Turn farther toward the ${state.direction} arrow`,
  };
}

export function chooseLivenessDirection(randomValue: number): LivenessDirection {
  return randomValue % 2 === 0 ? "left" : "right";
}
