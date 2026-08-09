import nodemailer from "nodemailer";

import { env } from "@/lib/env";
import { db } from "@/lib/db";

type MailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type SmtpConfig = {
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from?: string;
};

const SMTP_SETTING_KEYS = [
  "smtp.host",
  "smtp.port",
  "smtp.secure",
  "smtp.user",
  "smtp.pass",
  "smtp.from",
];

/** Resolve SMTP config: env vars win, then settings-page rows (DB). */
async function resolveSmtpConfig(): Promise<SmtpConfig> {
  const envConfig: SmtpConfig = {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM,
  };
  if (envConfig.host && envConfig.user) return envConfig;

  const hospital = await db.hospital.findFirst({ orderBy: { createdAt: "asc" } });
  if (!hospital) return envConfig;
  const rows = await db.settings.findMany({
    where: { hospitalId: hospital.id, key: { in: SMTP_SETTING_KEYS } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const dbConfig: SmtpConfig = {
    host: map["smtp.host"],
    port: Number(map["smtp.port"]) || 587,
    secure: map["smtp.secure"] === "true",
    user: map["smtp.user"],
    pass: map["smtp.pass"],
    from: map["smtp.from"] || envConfig.from,
  };
  if (dbConfig.host && dbConfig.user) return dbConfig;
  return envConfig;
}

/**
 * Sends an email via SMTP (env vars first, then settings-page config).
 * When no SMTP is configured (dev), returns `devOnlyToken` so callers can
 * fall back to logging the link.
 */
export async function sendEmail(input: MailInput): Promise<{ devOnlyToken?: boolean }> {
  const config = await resolveSmtpConfig();

  if (!config.host || !config.user) {
    console.warn("[email] SMTP not configured — email not delivered");
    return { devOnlyToken: true };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass ?? "" },
  });

  await transporter.sendMail({
    from: config.from ?? env.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html ?? input.text,
  });

  return {};
}
