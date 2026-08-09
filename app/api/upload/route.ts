import { requirePermission } from "@/lib/auth/guards";
import { ApiError, ok, route } from "@/lib/http";
import { isCloudinaryConfigured, uploadBuffer, UPLOAD_LIMITS } from "@/lib/cloudinary";
import { isUploadPurpose, type UploadPurpose } from "@/lib/upload";

const PURPOSE_GUARDS: Record<UploadPurpose, () => ReturnType<typeof requirePermission>> = {
  logo: () => requirePermission("settings:manage"),
  record: () => requirePermission("records:manage"),
};

export const POST = route(async (req: Request) => {
  const form = await req.formData().catch(() => null);
  if (!form) throw new ApiError(400, "Expected multipart form data");

  const purposeRaw = String(form.get("purpose") ?? "");
  if (!isUploadPurpose(purposeRaw)) throw new ApiError(400, "Invalid upload purpose");
  const purpose: UploadPurpose = purposeRaw;

  await PURPOSE_GUARDS[purpose]();

  if (!isCloudinaryConfigured()) {
    throw new ApiError(
      503,
      "Cloudinary is not configured — add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET"
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Missing file field");
  if (file.size === 0) throw new ApiError(400, "Empty file");

  const limit = UPLOAD_LIMITS[purpose];
  if (file.size > limit.maxBytes) {
    throw new ApiError(413, `File too large — max ${Math.round(limit.maxBytes / 1024 / 1024)} MB`);
  }
  if (!limit.mime.test(file.type)) {
    throw new ApiError(415, "Unsupported file type for this upload");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadBuffer(buffer, {
    folder: limit.folder,
    resourceType: limit.resourceType,
  });

  return ok({ url: result.url, publicId: result.publicId, name: file.name });
});
