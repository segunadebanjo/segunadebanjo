import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../../config.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Messages captured by the "memory" transport (tests). */
export const outbox: MailMessage[] = [];

export type MailTransport = 'smtp' | 'log' | 'memory';

export const mailTransport = (): MailTransport => config.MAIL_TRANSPORT ?? (config.SMTP_HOST ? 'smtp' : 'log');

let transporter: Transporter | null = null;
const smtp = () =>
  (transporter ??= nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
  }));

/**
 * Send an email.
 * - smtp: real delivery via SMTP_* settings.
 * - log: prints the email to the server console (development only; links in it are secrets, so this
 *   transport is refused in production).
 * - memory: stores it in `outbox` (tests).
 */
export async function sendMail(msg: MailMessage): Promise<void> {
  const transport = mailTransport();
  if (transport === 'memory') {
    outbox.push(msg);
    return;
  }
  if (transport === 'log') {
    if (config.NODE_ENV === 'production') throw new Error('No SMTP server configured (set SMTP_HOST); refusing to log emails in production');
    console.log(`\n[mail] (not sent — SMTP_HOST not set) To: ${msg.to}\n[mail] Subject: ${msg.subject}\n${msg.text}\n`);
    return;
  }
  await smtp().sendMail({ from: config.MAIL_FROM, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
