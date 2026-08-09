/* eslint-disable no-console */
import { execSync } from "child_process";
import { MongoMemoryReplSet } from "mongodb-memory-server";

async function main() {
  console.log("[t] starting mongod…");
  const t0 = Date.now();
  const mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  console.log(`[t] mongod up in ${Date.now() - t0}ms`);

  process.env.DATABASE_URL = mongod.getUri("hospital_management");
  console.log(`[t] DATABASE_URL=${process.env.DATABASE_URL}`);

  console.log("[t] prisma db push…");
  const t1 = Date.now();
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: process.env,
    stdio: "inherit",
    timeout: 120000,
  });
  console.log(`[t] db push done in ${Date.now() - t1}ms`);

  await mongod.stop();
  console.log("[t] DONE");
}

main().catch((e) => {
  console.error("[t] FAILED:", e.message ?? e);
  process.exit(1);
});
