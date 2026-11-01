/**
 * Integration-test harness.
 *
 * Boots an in-memory MongoDB **replica set** (the app uses Prisma
 * `$transaction`, which MongoDB refuses on a standalone node), pushes the real
 * schema, and exposes the in-memory URI through `DATABASE_URL`.
 *
 * Import this module's `useTestDatabase()` from a `beforeAll` hook, BEFORE
 * importing any `@/lib/db` consumer — `@/lib/db` captures `env.DATABASE_URL` at
 * module scope and caches the client on `globalThis`.
 */
import { execSync } from "node:child_process";
import { MongoMemoryReplSet } from "mongodb-memory-server";

let replset: MongoMemoryReplSet | null = null;

export async function useTestDatabase(): Promise<void> {
  if (replset) return;

  replset = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [
      {
        storageEngine: "wiredTiger",
        // Keep the box (and CI) well inside its memory budget.
        args: ["--wiredTigerCacheSizeGB", "0.25"],
      },
    ],
  } as Parameters<typeof MongoMemoryReplSet.create>[0]);

  const uri = replset.getUri("hospital_management");
  process.env.DATABASE_URL = uri;

  // Push the real schema so tests exercise the shipped indexes and relations.
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env },
    stdio: "pipe",
  });
}

export async function stopTestDatabase(): Promise<void> {
  if (!replset) return;
  await replset.stop();
  replset = null;
}

/** Wipes every collection without tearing down the replica set. */
export async function resetCollections(db: {
  $runCommandRaw?: unknown;
}): Promise<void> {
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(process.env.DATABASE_URL!);
  await client.connect();
  const names = (await client.db().collections()).map((c) => c.collectionName);
  for (const name of names) {
    await client.db().collection(name).deleteMany({});
  }
  await client.close();
  void db;
}