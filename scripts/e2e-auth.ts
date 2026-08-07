/* eslint-disable no-console */
/**
 * End-to-end auth smoke test using an in-memory MongoDB.
 * Starts mongod -> prisma db push -> seed -> next start -> exercises the API.
 * Run: npx tsx scripts/e2e-auth.ts
 */
import { execSync, spawn } from "child_process";
import { MongoMemoryReplSet } from "mongodb-memory-server";

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

function post(base: string, path: string, body: unknown, cookie = "") {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function get(base: string, path: string, cookie = "") {
  return fetch(`${base}${path}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✔ ${msg}`);
}

function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(`FAIL: ${msg} (expected ${expected}, got ${actual})`);
  }
  console.log(`  ✔ ${msg}`);
}

async function main() {
  console.log("[e2e] starting mongod (replica set)…");
  const mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.DATABASE_URL = mongod.getUri("hospital_management");
  process.env.DATABASE_URL = mongod.getUri("hospital_management");

  console.log("[e2e] prisma db push…");
  execSync("npx prisma db push --skip-generate", {
    env: process.env,
    stdio: "pipe",
  });

  console.log("[e2e] seeding…");
  execSync("npx tsx prisma/seed.ts", { env: process.env, stdio: "pipe" });

  const PORT = "3100";
  console.log(`[e2e] starting next on :${PORT}…`);
  const server = spawn("npx", ["next", "start", "-p", PORT], {
    env: { ...process.env },
    stdio: "ignore",
  });

  try {
    const base = `http://localhost:${PORT}`;
    await waitForServer(`${base}/login`);
    const dash = await fetch(`${base}/dashboard`, { redirect: "manual" });
    assertEq(dash.status, 307, "logged-out /dashboard redirects");

    const login = await post(base, "/api/auth/login", {
      email: "admin@hospital.com",
      password: "Admin@1234",
    });
    assertEq(login.status, 200, "login admin");
    const jar = (login.headers.get("set-cookie") ?? "")
      .split(",")
      .map((c) => c.split(";")[0])
      .join("; ");

    const me = await get(base, "/api/auth/me", jar);
    const meBody = await me.json();
    assertEq(me.status, 200, "GET /api/auth/me");
    assertEq(meBody.data.user.email, "admin@hospital.com", "me email");
    assertEq(meBody.data.user.roleName, "SUPER_ADMIN", "me role");

    const audit = await get(base, "/api/audit-logs?pageSize=10", jar);
    const auditBody = await audit.json();
    assertEq(audit.status, 200, "GET /api/audit-logs");
    assert(Array.isArray(auditBody.data.items), "audit returns array");
    assert(auditBody.data.meta.total >= 1, "audit has LOGIN event(s)");

    const users = await post(
      base,
      "/api/users",
      {
        firstName: "Test",
        lastName: "User",
        email: "test@hospital.com",
        password: "TestUser@123",
        roleName: "RECEPTIONIST",
      },
      jar
    );
    assertEq(users.status, 201, "POST /api/users as admin");

    const anon = await get(base, "/api/audit-logs");
    assertEq(anon.status, 401, "audit-logs without auth -> 401");

    const badLogin = await post(base, "/api/auth/login", {
      email: "admin@hospital.com",
      password: "wrong",
    });
    assertEq(badLogin.status, 401, "bad password -> 401");

    const logout = await post(base, "/api/auth/logout", {}, jar);
    assertEq(logout.status, 200, "logout");

    console.log("\n[e2e] ALL AUTH CHECKS PASSED");
  } finally {
    server.kill("SIGTERM");
    await mongod.stop();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});