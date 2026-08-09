import { v2 as cloudinary } from "cloudinary";

import { env } from "@/lib/env";
import type { UploadPurpose } from "@/lib/upload";

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
  );
}

function client() {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
}

export type UploadResult = { url: string; publicId: string };

/**
 * Uploads a file buffer to Cloudinary. Pass `resourceType: "raw"` for
 * non-image files (PDFs etc.).
 */
export function uploadBuffer(
  buffer: Buffer,
  options: { folder: string; resourceType?: "auto" | "image" | "raw" }
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const stream = client().uploader.upload_stream(
      {
        folder: options.folder,
        resource_type: options.resourceType ?? "auto",
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url) return reject(new Error("Upload failed: no URL returned"));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

export const UPLOAD_LIMITS: Record<
  UploadPurpose,
  { maxBytes: number; mime: RegExp; folder: string; resourceType: "auto" | "image" | "raw" }
> = {
  logo: {
    maxBytes: 2 * 1024 * 1024,
    mime: /^image\/(png|jpe?g|webp|svg\+xml)$/,
    folder: "hospital/branding",
    resourceType: "image",
  },
  record: {
    maxBytes: 5 * 1024 * 1024,
    mime: /^image\/(png|jpe?g|webp)|^application\/pdf$/,
    folder: "hospital/records",
    resourceType: "auto",
  },
};
