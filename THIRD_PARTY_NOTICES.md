# Third-party runtime assets

## MediaPipe Tasks Vision 1.1.1

The browser liveness demo uses `@mediapipe/tasks-vision@1.1.1`, distributed under the Apache-2.0 licence. The matching WASM files are copied from the installed npm package into `public/mediapipe/wasm` so the demo can run without a CDN.

- Package: <https://www.npmjs.com/package/@mediapipe/tasks-vision>
- Licence: <https://www.apache.org/licenses/LICENSE-2.0>

## Face Landmarker model

The self-hosted model was downloaded from the official URL used in the MediaPipe package documentation:

<https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task>

SHA-256: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`

The app processes camera frames in the browser and does not intentionally upload or persist images, video, landmarks or face templates. Review the MediaPipe privacy notice and your deployment obligations before any non-demo use.
