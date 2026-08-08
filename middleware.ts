import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

type RoleKey =
  | "SUPER_ADMIN"
  | "HOSPITAL_ADMIN"
  | "DOCTOR"
  | "NURSE"
  | "RECEPTIONIST"
  | "PHARMACIST"
  | "LAB_TECHNICIAN"
  | "ACCOUNTANT"
  | "PATIENT";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

/** Coarse route→role gate (fine-grained permission checks happen server-side). */
const ROUTE_ROLES: Record<string, RoleKey[]> = {
  "/patients": ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "PHARMACIST", "LAB_TECHNICIAN", "ACCOUNTANT"],
  "/doctors": ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR"],
  "/appointments": ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"],
  "/departments": ["SUPER_ADMIN", "HOSPITAL_ADMIN", "RECEPTIONIST"],
  "/rooms": ["SUPER_ADMIN", "HOSPITAL_ADMIN", "NURSE"],
  "/admissions": ["SUPER_ADMIN", "HOSPITAL_ADMIN", "NURSE", "DOCTOR"],
  "/discharges": ["SUPER_ADMIN", "HOSPITAL_ADMIN", "NURSE", "DOCTOR"],
  "/opd": ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"],
  "/emergency": ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "NURSE"],
  "/nurses": ["SUPER_ADMIN", "HOSPITAL_ADMIN", "NURSE"],
  "/laboratory": ["SUPER_ADMIN", "HOSPITAL_ADMIN", "LAB_TECHNICIAN", "DOCTOR", "NURSE"],
  "/radiology": ["SUPER_ADMIN", "HOSPITAL_ADMIN", "LAB_TECHNICIAN", "DOCTOR"],
  "/pharmacy": ["SUPER_ADMIN", "HOSPITAL_ADMIN", "PHARMACIST"],
  "/inventory": ["SUPER_ADMIN", "HOSPITAL_ADMIN", "PHARMACIST"],
  "/billing": ["SUPER_ADMIN", "HOSPITAL_ADMIN", "ACCOUNTANT", "RECEPTIONIST"],
  "/payments": ["SUPER_ADMIN", "HOSPITAL_ADMIN", "ACCOUNTANT"],
  "/insurance": ["SUPER_ADMIN", "HOSPITAL_ADMIN", "ACCOUNTANT"],
  "/staff": ["SUPER_ADMIN", "HOSPITAL_ADMIN"],
  "/hr": ["SUPER_ADMIN", "HOSPITAL_ADMIN"],
  "/payroll": ["SUPER_ADMIN", "HOSPITAL_ADMIN", "ACCOUNTANT"],
  "/reports": ["SUPER_ADMIN", "HOSPITAL_ADMIN", "ACCOUNTANT", "LAB_TECHNICIAN"],
  "/prescriptions": ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "PHARMACIST"],
  "/records": ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "NURSE"],
  "/analytics": ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "ACCOUNTANT"],
  "/notifications": ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "PHARMACIST", "LAB_TECHNICIAN", "ACCOUNTANT"],
  "/settings": ["SUPER_ADMIN", "HOSPITAL_ADMIN"],
  "/audit-logs": ["SUPER_ADMIN", "HOSPITAL_ADMIN"],
  "/users": ["SUPER_ADMIN", "HOSPITAL_ADMIN"],
};

const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET ?? "");

async function verifyToken(token: string): Promise<{ sub: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return { sub: String(payload.sub), role: String(payload.role) };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isApi = pathname.startsWith("/api");
  const isAuthApi = pathname.startsWith("/api/auth");

  const accessToken = req.cookies.get("hms_access")?.value;
  const refreshToken = req.cookies.get("hms_refresh")?.value;
  const payload = accessToken ? await verifyToken(accessToken) : null;

  // ---- API: let route guards handle auth; block unknown origins on state-changing calls.
  if (isApi) {
    if (isAuthApi) return NextResponse.next();
    if (!payload && !refreshToken) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (req.method !== "GET" && !isSameOrigin(req)) {
      return NextResponse.json({ success: false, error: "Invalid origin" }, { status: 403 });
    }
    return NextResponse.next();
  }

  // ---- Auth pages: signed-in users go straight to the dashboard.
  if (isPublic) {
    if (payload || refreshToken) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ---- Protected pages.
  if (!payload && !refreshToken) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // Coarse role gate for page access.
  if (payload) {
    const prefix = Object.keys(ROUTE_ROLES)
      .sort((a, b) => b.length - a.length)
      .find((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (prefix) {
      const allowed = ROUTE_ROLES[prefix];
      if (payload.role && !allowed.includes(payload.role as RoleKey)) {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
  }

  const response = NextResponse.next();

  // Security headers.
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  return response;
}

function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients
  const host = req.headers.get("host");
  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};