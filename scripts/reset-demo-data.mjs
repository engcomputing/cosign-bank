import { copyFile } from "node:fs/promises";
import path from "node:path";

const dataDirectory = path.join(process.cwd(), "data");
await copyFile(
  path.join(dataDirectory, "bank-demo-db.seed.json"),
  path.join(dataDirectory, "bank-demo-db.json"),
);

console.log("Bank demo data reset: data/bank-demo-db.json");
