export type UploadPurpose = "logo" | "record";

export const UPLOAD_PURPOSES: UploadPurpose[] = ["logo", "record"];

export function isUploadPurpose(value: string): value is UploadPurpose {
  return (UPLOAD_PURPOSES as string[]).includes(value);
}
