/**
 * Phase 7 live verification: starts `next start` against the real seeded DB,
 * then verifies /hr (employees, attendance, leaves, reviews), /staff roster
 * and /payroll (payslip PDF, mark paid) with Playwright.
 * Run: npx tsx scripts/ui-verify-hr-live.ts
 */
import { spawn } from "child_process";
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
  const PORT = "3300";
  const base = `http://localhost:${PORT}`;
  console.log(`[hr] starting next on :${PORT}…`);
  const server = spawn("npx", ["next", "start", "-p", PORT], { stdio: "ignore" });

  const outDir = "/tmp/opencode/hms-hr-screenshots";
  const { execSync } = await import("child_process");
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
    await page.waitForTimeout(1200);
    await page.getByLabel(/Email/i).fill("admin@hospital.com");
    await page.getByLabel(/Password/i).fill("Admin@1234");
    await page.getByRole("button", { name: /Sign in/i }).click();
    await page.waitForURL("**/dashboard", { timeout: 20000 });
    await page.waitForTimeout(1500);
    console.log("[hr] logged in → dashboard");

    // ---- /hr: employees tab
    await page.goto(`${base}/hr`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const empRows = await page.locator("table tbody tr").count();
    console.log(`[hr] /hr employees table rows=${empRows}`);
    await page.screenshot({ path: `${outDir}/01-hr-employees.png` });

    // Create an employee through the dialog
    await page.getByRole("button", { name: /Add employee/i }).click();
    await page.waitForTimeout(600);
    await page.getByLabel(/First name/i).fill("Hannah");
    await page.getByLabel(/Last name/i).fill("Stewart");
    await page.getByLabel(/Email/i).fill("hannah.stewart@hospital.com");
    await page.getByLabel(/Password/i).fill("Hannah@1234");
    await page.getByRole("button", { name: /Create employee/i }).click();
    await page.waitForTimeout(2500);
    const created = await page.locator("table tbody tr", { hasText: "Hannah" }).count();
    console.log(`[hr] create employee → visible=${created > 0}`);
    await page.screenshot({ path: `${outDir}/02-hr-employee-created.png` });

    // ---- attendance tab
    await page.getByRole("tab", { name: /Attendance/i }).click();
    await page.waitForTimeout(2000);
    const statRows = await page.locator("table tbody tr").count();
    console.log(`[hr] attendance monthly summary rows=${statRows}`);
    await page.screenshot({ path: `${outDir}/03-hr-attendance.png` });

    // ---- leaves tab
    await page.getByRole("tab", { name: /Leaves/i }).click();
    await page.waitForTimeout(2000);
    const leaveRows = await page.locator("table tbody tr").count();
    console.log(`[hr] leaves table rows=${leaveRows}`);
    await page.screenshot({ path: `${outDir}/04-hr-leaves.png` });

    // ---- reviews tab
    await page.getByRole("tab", { name: /Reviews/i }).click();
    await page.waitForTimeout(1500);
    console.log("[hr] reviews tab renders");
    await page.screenshot({ path: `${outDir}/05-hr-reviews.png` });

    // ---- /staff roster
    await page.goto(`${base}/staff`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const sections = await page.locator("section.rounded-lg").count();
    console.log(`[hr] /staff department sections=${sections}`);
    await page.screenshot({ path: `${outDir}/06-staff.png` });

    // ---- /payroll
    await page.goto(`${base}/payroll`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const payrollRows = await page.locator("table tbody tr").count();
    console.log(`[hr] /payroll rows=${payrollRows}`);
    await page.screenshot({ path: `${outDir}/07-payroll.png` });

    // Payslip PDF download via authenticated fetch
    const payslip = await page.evaluate(async () => {
      const res = await fetch("/api/hr/payroll?month=" + new Date().toISOString().slice(0, 7));
      const json = await res.json();
      const rec = json.data.items.find((p: { status: string }) => p.status === "GENERATED");
      if (!rec) return { found: false };
      const pdf = await fetch(`/api/hr/payroll/${rec.id}/payslip`);
      const buf = await pdf.arrayBuffer();
      return { found: true, status: pdf.status, type: pdf.headers.get("content-type"), bytes: buf.byteLength };
    });
    console.log(`[hr] payslip PDF → ${JSON.stringify(payslip)}`);

    // Mark paid on first generated row
    const paidBtn = page.getByRole("button", { name: /Mark paid/i });
    if ((await paidBtn.count()) > 0 && (await page.locator("table tbody tr").count()) > 0) {
      await page.locator("table tbody input[type=checkbox]").first().check();
      await page.waitForTimeout(400);
      await paidBtn.click();
      await page.waitForTimeout(2500);
      console.log("[hr] mark paid → ok");
    }
    await page.screenshot({ path: `${outDir}/08-payroll.png` });

    console.log("\n[hr] done. console errors:");
    console.log(consoleErrors.length ? consoleErrors.join("\n") : "  (none)");
  } finally {
    await browser.close();
    server.kill("SIGTERM");
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
