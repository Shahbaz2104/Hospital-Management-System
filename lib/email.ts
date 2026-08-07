import nodemailer from "nodemailer";

import { env } from "@/lib/env";

type MailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Sends an email via SMTP. When SMTP isn't configured (dev),
 * returns `devOnlyToken` so callers can fall back to logging the link.
 */
export async function sendEmail(input: MailInput): Promise<{ devOnlyToken?: boolean }> {
  if (!env.SMTP_HOST || !env.SMTP_USER) {
    console.warn("[email] SMTP not configured — email not delivered");
    return { devOnlyToken: true };
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html ?? input.text,
  });

  return {};
}