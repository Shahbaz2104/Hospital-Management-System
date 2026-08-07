/* eslint-disable no-console */
/**
 * UI verification: boots in-memory MongoDB, pushes the schema, seeds the
 * demo data, starts Next.js, then uses Playwright to log in and screenshot
 * the Phase 1 + Phase 2 pages.
 * Run: npx tsx scripts/ui-verify.ts
 */
import { execSync, spawn } from "child_process";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { chromium } from "playwright";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url: string, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {}
    await sleep(500);
  }
  throw new Error(`Server did not come up at ${url}`);
}

async function main() {
  console.log("[ui] starting mongod (replica set)…");
  const mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.DATABASE_URL = mongod.getUri("hospital_management");
  process.env.AUTH_SECRET = "ui-verify-secret-at-least-32-characters-long";

  console.log("[ui] prisma db push…");
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: process.env,
    stdio: "pipe",
  });

  console.log("[ui] seeding…");
  execSync("npx tsx prisma/seed.ts", { env: process.env, stdio: "pipe" });

  const PORT = "3100";
  console.log(`[ui] starting next on :${PORT}…`);
  const server = spawn("npx", ["next", "start", "-p", PORT], {
    env: { ...process.env },
    stdio: "ignore",
  });

  const base = `http://localhost:${PORT}`;
  const outDir = "/tmp/opencode/hms-screenshots";
  execSync(`mkdir -p ${outDir}`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

  try {
    await waitForServer(`${base}/login`);

    const res = await page.goto(`${base}/login`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${outDir}/01-login.png`, fullPage: false });
    console.log(`[ui] login page status=${res?.status()}`);

    await page.getByLabel(/Email/i).fill("admin@hospital.com");
    await page.getByLabel(/Password/i).fill("Admin@1234");
    await page.getByRole("button", { name: /Sign in/i }).click();
    await page.waitForURL("**/dashboard", { timeout: 15000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${outDir}/02-dashboard.png`, fullPage: false });
    console.log("[ui] logged in → dashboard");

    for (const route of ["departments", "doctors", "nurses", "rooms"]) {
      await page.goto(`${base}/${route}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(900);
      const title = await page.title();
      const hasTable = (await page.locator("table, .rounded-lg").count()) > 0;
      await page.screenshot({ path: `${outDir}/03-${route}.png`, fullPage: false });
      console.log(`→ /${route} title="${title}" content=${hasTable ? "yes" : "no"}`);
    }

    console.log("\n[ui] done. console errors:");
    console.log(consoleErrors.length ? consoleErrors.join("\n") : "  (none)");
  } finally {
    await browser.close();
    server.kill("SIGTERM");
    await mongod.stop();
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});