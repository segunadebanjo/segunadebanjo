// Outgoing email (password resets and security notices) over SMTP via nodemailer.
// MAIL_TRANSPORT=log prints messages to the server console instead (development only).
import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { esc } from '../../shared/render.js';

const m = config.mail;
let transporter = null;
if (m.transport === 'smtp' && m.host) {
  transporter = nodemailer.createTransport({
    host: m.host, port: m.port, secure: m.secure,
    auth: m.user ? { user: m.user, pass: m.pass } : undefined,
  });
} else if (m.transport === 'log') {
  transporter = nodemailer.createTransport({ jsonTransport: true });
}

export const mailEnabled = () => Boolean(transporter);
export const mailMode = () => (transporter ? m.transport : 'off');
const fromAddress = () => m.from || (m.user && m.user.includes('@') ? `InsurePress Studio <${m.user}>` : 'InsurePress Studio <no-reply@localhost>');

export async function sendMail({ to, subject, text, html }) {
  if (!transporter) throw new Error('Email is not configured');
  const info = await transporter.sendMail({ from: fromAddress(), to, subject, text, html });
  if (m.transport === 'log') {
    const msg = JSON.parse(info.message);
    console.log(`\n[mail:log] To: ${to}\n[mail:log] Subject: ${subject}\n${msg.text}\n`);
  }
  return info;
}

/** Checks SMTP settings at start-up so misconfiguration shows in the logs, not when a user needs a reset. */
export async function verifyMail() {
  if (!transporter) {
    console.warn('⚠ Email is not configured (SMTP_HOST unset): "Forgot password" is hidden. Admins can still reset passwords.');
    return;
  }
  if (m.transport !== 'smtp') return;
  try { await transporter.verify(); console.log(`Email: SMTP ready (${m.host}:${m.port})`); } catch (e) {
    console.error(`⚠ Email: SMTP check failed (${e.message}). Password reset emails will not be delivered.`);
  }
}

function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#1e293b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#0F2942;padding:18px 28px;color:#ffffff;font-size:18px;font-weight:bold;font-family:Georgia,serif">InsurePress <span style="color:#F59E0B;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px">STUDIO</span></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 14px;font-size:20px;color:#0F2942;font-family:Georgia,serif">${esc(title)}</h1>
${bodyHtml}
</td></tr></table>
<p style="font-size:11px;color:#94a3b8;margin-top:16px">This is an automated security email from InsurePress Studio.</p>
</td></tr></table></body></html>`;
}

export function resetEmail({ name, link, minutes }) {
  const first = (name || '').split(' ')[0] || 'there';
  const text = `Hi ${first},

Someone (hopefully you) asked to reset the password for your InsurePress Studio account.

Choose a new password here (the link works once and expires in ${minutes} minutes):
${link}

If you didn't ask for this, you can ignore this email: your password won't change.`;
  const html = layout('Reset your password', `
<p style="margin:0 0 12px;font-size:15px;line-height:1.55">Hi ${esc(first)},</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.55">Someone (hopefully you) asked to reset the password for your InsurePress Studio account.</p>
<p style="margin:0 0 22px"><a href="${esc(link)}" style="display:inline-block;background:#D97706;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px;font-size:15px">Choose a new password</a></p>
<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#475569">The link works once and expires in ${minutes} minutes. If the button doesn't work, copy this address into your browser:<br><span style="word-break:break-all;color:#0F2942">${esc(link)}</span></p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#475569">If you didn't ask for this, ignore this email: your password won't change.</p>`);
  return { subject: 'Reset your InsurePress Studio password', text, html };
}

export function passwordChangedEmail({ name, when, how }) {
  const first = (name || '').split(' ')[0] || 'there';
  const text = `Hi ${first},

The password for your InsurePress Studio account was changed ${how} on ${when}. You've been signed out on your other devices.

If this wasn't you, contact your InsurePress Studio admin straight away.`;
  const html = layout('Your password was changed', `
<p style="margin:0 0 12px;font-size:15px;line-height:1.55">Hi ${esc(first)},</p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.55">The password for your InsurePress Studio account was changed ${esc(how)} on <b>${esc(when)}</b>. You've been signed out on your other devices.</p>
<p style="margin:0;font-size:15px;line-height:1.55"><b>If this wasn't you</b>, contact your InsurePress Studio admin straight away.</p>`);
  return { subject: 'Your InsurePress Studio password was changed', text, html };
}
