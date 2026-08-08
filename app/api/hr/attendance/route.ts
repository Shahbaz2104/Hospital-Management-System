import { requirePermission } from "@/lib/auth/guards";
import { assertInput, ok, route } from "@/lib/http";
import { listAttendance, markAttendance } from "@/services/hr";
import { attendanceMarkSchema } from "@/validators/hr";

export const GET = route(async (req) => {
  await requirePermission("hr:read");
  const url = new URL(req.url);
  return ok(
    await listAttendance({
      month: url.searchParams.get("month")?.trim() || undefined,
      date: url.searchParams.get("date")?.trim() || undefined,
      employeeId: url.searchParams.get("employeeId")?.trim() || undefined,
    })
  );
});

export const POST = route(async (req) => {
  const actor = await requirePermission("hr:manage");
  const input = assertInput(attendanceMarkSchema, await req.json());
  const records = await markAttendance({ userId: actor.id, hospitalId: actor.hospitalId }, input.entries);
  return ok({ count: records.length }, { status: 201 });
});
