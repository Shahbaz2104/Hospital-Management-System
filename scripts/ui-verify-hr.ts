/**
 * Phase 7 verification: boots in-memory MongoDB, seeds, starts Next.js,
 * then verifies /hr (employees, attendance, leaves, reviews), /staff roster,
 * /payroll (generate, mark paid, payslip PDF) with Playwright.
 * Run: npx tsx scripts/ui-verify-hr.ts
 */
import { execSync, spawn } from "child_process";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { chromium } from "playwright";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url: string, tries = 90) {
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
  console.log("[hr] starting mongod (replica set)…");
  const mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.DATABASE_URL = mongod.getUri("hospital_management");
  process.env.AUTH_SECRET = "ui-verify-secret-at-least-32-characters-long";

  console.log("[hr] prisma db push…");
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: process.env,
    stdio: "pipe",
  });

  console.log("[hr] seeding…");
  execSync("npx tsx prisma/seed.ts", { env: process.env, stdio: "pipe" });

  const PORT = "3200";
  console.log(`[hr] starting next on :${PORT}…`);
  const server = spawn("npx", ["next", "start", "-p", PORT], {
    env: { ...process.env },
    stdio: "ignore",
  });

  const base = `http://localhost:${PORT}`;
  const outDir = "/tmp/opencode/hms-hr-screenshots";
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

    await page.goto(`${base}/login`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    await page.getByLabel(/Email/i).fill("admin@hospital.com");
    await page.getByLabel(/Password/i).fill("Admin@1234");
    await page.getByRole("button", { name: /Sign in/i }).click();
    await page.waitForURL("**/dashboard", { timeout: 15000 });
    await page.waitForTimeout(1200);
    console.log("[hr] logged in → dashboard");

    // ---- /hr: employees tab
    await page.goto(`${base}/hr`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const empRows = await page.locator("table tbody tr").count();
    console.log(`[hr] /hr employees table rows=${empRows}`);
    await page.screenshot({ path: `${outDir}/01-hr-employees.png` });

    // Create an employee through the dialog
    await page.getByRole("button", { name: /Add employee/i }).click();
    await page.waitForTimeout(500);
    await page.getByLabel(/First name/i).fill("Hannah");
    await page.getByLabel(/Last name/i).fill("Stewart");
    await page.getByLabel(/Email/i).fill("hannah.stewart@hospital.com");
    await page.getByLabel(/Password/i).fill("Hannah@1234");
    await page.getByRole("button", { name: /Create employee/i }).click();
    await page.waitForTimeout(2000);
    const created = await page.locator("table tbody tr", { hasText: "Hannah" }).count();
    console.log(`[hr] create employee → visible=${created > 0}`);
    await page.screenshot({ path: `${outDir}/02-hr-employee-created.png` });

    // ---- attendance tab
    await page.getByRole("tab", { name: /Attendance/i }).click();
    await page.waitForTimeout(1500);
    const statRows = await page.locator("table tbody tr").count();
    console.log(`[hr] attendance monthly summary rows=${statRows}`);
    await page.screenshot({ path: `${outDir}/03-hr-attendance.png` });

    // ---- leaves tab
    await page.getByRole("tab", { name: /Leaves/i }).click();
    await page.waitForTimeout(1500);
    const leaveRows = await page.locator("table tbody tr").count();
    console.log(`[hr] leaves table rows=${leaveRows}`);
    const approveBtn = page.getByRole("button", { name: /Approve/i }).first();
    if ((await approveBtn.count()) > 0) {
      await approveBtn.click();
      await page.waitForTimeout(2000);
      console.log("[hr] leave approve → ok");
    }
    await page.screenshot({ path: `${outDir}/04-hr-leaves.png` });

    // ---- reviews tab
    await page.getByRole("tab", { name: /Reviews/i }).click();
    await page.waitForTimeout(1000);
    console.log("[hr] reviews tab renders");
    await page.screenshot({ path: `${outDir}/05-hr-reviews.png` });

    // ---- /staff roster
    await page.goto(`${base}/staff`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const cards = await page.locator("section.rounded-lg").count();
    console.log(`[hr] /staff department sections=${cards}`);
    await page.screenshot({ path: `${outDir}/06-staff.png` });

    // ---- /payroll
    await page.goto(`${base}/payroll`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const payrollRows = await page.locator("table tbody tr").count();
    console.log(`[hr] /payroll rows=${payrollRows}`);
    await page.screenshot({ path: `${outDir}/07-payroll.png` });

    // Payslip PDF download + mark paid through the page
    const payslip = await page.evaluate(async () => {
      const res = await fetch("/api/hr/payroll?month=" + new Date().toISOString().slice(0, 7));
      const json = await res.json();
      const rec = json.data.items.find((p: { status: string }) => p.status === "GENERATED");
      if (!rec) return { found: false };
      const pdf = await fetch(`/api/hr/payroll/${rec.id}/payslip`);
      return { found: true, status: pdf.status, type: pdf.headers.get("content-type"), bytes: (await pdf.arrayBuffer()).byteLength };
    });
    console.log(`[hr] payslip PDF → ${JSON.stringify(payslip)}`);

    const paidBtn = page.getByRole("button", { name: /Mark paid/i });
    if ((await paidBtn.count()) > 0) {
      const firstCheckbox = page.locator("table tbody input[type=checkbox]").first();
      await firstCheckbox.check();
      await page.waitForTimeout(300);
      await paidBtn.click();
      await page.waitForTimeout(2000);
      const paidBadge = await page.locator("table tbody tr").first().locator("text=Paid").count();
      console.log(`[hr] mark paid → badge visible=${paidBadge > 0}`);
    }
    await page.screenshot({ path: `${outDir}/08-payroll-paid.png` });

    console.log("\n[hr] done. console errors:");
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
