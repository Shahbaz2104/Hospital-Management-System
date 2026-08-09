import "dotenv/config";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseMongoUrl(url: string): { uri: string; db: string } {
  const m = url.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)\/([^?]+)/);
  if (!m) throw new Error("DATABASE_URL is not a mongodb connection string");
  return { uri: m[1], db: m[2] };
}

const url = process.env.DATABASE_URL ?? "";
const { uri, db } = parseMongoUrl(url);
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "backups", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19).replace("T", "_"));
mkdirSync(dir, { recursive: true });

execFileSync(
  "mongodump",
  [
    `--uri=${uri}`,
    `--db=${db}`,
    `--archive=${path.join(dir, "dump.gz")}`,
    "--gzip",
  ],
  { stdio: "inherit" },
);

console.log(`Backup written to ${dir}/dump.gz`);
