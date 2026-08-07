import { NextResponse } from "next/server";
import { z } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function fail(
  status: number,
  message: string,
  details?: unknown,
  init?: ResponseInit
) {
  return NextResponse.json({ success: false, error: message, details }, { status, ...init });
}

export function assertInput<S extends z.ZodType<unknown, z.ZodTypeDef>>(
  schema: S,
  input: unknown
): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiError(
      400,
      "Validation failed",
      result.error.flatten().fieldErrors
    );
  }
  return result.data;
}

type Handler = (
  req: Request,
  ctx: { params: Promise<Record<string, string>> }
) => Promise<Response>;

export function route(handler: Handler) {
  return async (
    req: Request,
    ctx: { params: Promise<Record<string, string>> }
  ): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      if (error instanceof ApiError) {
        return fail(error.status, error.message, error.details);
      }
      console.error("[api]", error);
      return fail(500, "Something went wrong");
    }
  };
}

export function getIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  );
}

export function getUserAgent(req: Request): string {
  return req.headers.get("user-agent") ?? "unknown";
}