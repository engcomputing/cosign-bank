import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDirectory = path.join(process.cwd(), "data");
await mkdir(dataDirectory, { recursive: true });
await writeFile(path.join(dataDirectory, "face-profiles.json"), "[]\n", "utf8");
console.log("Face profiles deleted: data/face-profiles.json");
