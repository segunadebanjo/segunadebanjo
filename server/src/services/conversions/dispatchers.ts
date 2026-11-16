import { createHash } from 'node:crypto';
import type { ConversionEventType } from '@prisma/client';
import { config, credentials } from '../../config.js';
import { googleBase, googleCustomerId, googleHeaders } from '../platforms/google.js';
import { httpJson } from '../platforms/types.js';
import type { ClickIdType } from './attribution.js';

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
export const normaliseEmail = (e: string) => e.trim().toLowerCase();
/** E.164 digits only, Nigerian local numbers (0803…) become 234803… */
export const normalisePhone = (p: string) => {
  const digits = p.replace(/\D/g, '');
  return digits.startsWith('0') && digits.length === 11 ? `234${digits.slice(1)}` : digits;
};

export interface DispatchEvent {
  eventId: string;
  eventType: ConversionEventType;
  occurredAt: Date;
  value: number;
  currency: string;
  clickId: string | null;
  clickIdType: ClickIdType | null;
  hashedEmail: string | null;
  hashedPhone: string | null;
  landingUrl?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
}

export interface DispatchResult {
  destination: 'META_CAPI' | 'GOOGLE_ENHANCED_CONVERSIONS' | 'LINKEDIN_CAPI';
  status: 'sent' | 'simulated' | 'skipped' | 'failed';
  detail: string;
}

const META_EVENT: Record<ConversionEventType, string> = { QUOTE_STARTED: 'Lead', APPLICATION_SUBMITTED: 'SubmitApplication', POLICY_PURCHASED: 'Purchase' };

async function meta(e: DispatchEvent): Promise<DispatchResult> {
  const d = 'META_CAPI' as const;
  if (e.clickIdType !== 'fbclid' && !e.hashedEmail && !e.hashedPhone) return { destination: d, status: 'skipped', detail: 'no fbclid or hashed identifiers' };
  const fbc = e.clickIdType === 'fbclid' && e.clickId ? `fb.1.${e.occurredAt.getTime()}.${e.clickId}` : undefined;
  const payload = {
    data: [
      {
        event_name: META_EVENT[e.eventType],
        event_time: Math.floor(e.occurredAt.getTime() / 1000),
        event_id: e.eventId, // dedup with browser pixel
        action_source: 'website',
        event_source_url: e.landingUrl ?? undefined,
        user_data: {
          ...(fbc ? { fbc } : {}),
          ...(e.hashedEmail ? { em: [e.hashedEmail] } : {}),
          ...(e.hashedPhone ? { ph: [e.hashedPhone] } : {}),
          ...(e.clientIp ? { client_ip_address: e.clientIp } : {}),
          ...(e.userAgent ? { client_user_agent: e.userAgent } : {}),
        },
        custom_data: { value: e.value, currency: e.currency },
      },
    ],
  };
  if (config.SANDBOX_MODE || !credentials.metaCapi) return { destination: d, status: 'simulated', detail: `would POST ${META_EVENT[e.eventType]} to /${config.META_PIXEL_ID ?? '<pixel>'}/events` };
  await httpJson('META_CAPI', `https://graph.facebook.com/${config.META_API_VERSION}/${config.META_PIXEL_ID}/events?access_token=${encodeURIComponent(config.META_ACCESS_TOKEN!)}`, { method: 'POST', json: payload });
  return { destination: d, status: 'sent', detail: `${META_EVENT[e.eventType]} accepted` };
}

/** Google Ads offline click conversion upload, with hashed email for Enhanced Conversions for Leads. */
async function google(e: DispatchEvent): Promise<DispatchResult> {
  const d = 'GOOGLE_ENHANCED_CONVERSIONS' as const;
  if (e.clickIdType !== 'gclid' && !e.hashedEmail) return { destination: d, status: 'skipped', detail: 'no gclid or hashed email' };
  if (config.SANDBOX_MODE || !credentials.google || !credentials.googleConversions)
    return { destination: d, status: 'simulated', detail: `would upload ${e.eventType} via :uploadClickConversions` };
  // Google wants "yyyy-mm-dd hh:mm:ss+00:00"
  const ts = e.occurredAt.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '+00:00');
  const conversion = {
    conversionAction: `customers/${googleCustomerId()}/conversionActions/${config.GOOGLE_ADS_CONVERSION_ACTION_ID}`,
    conversionDateTime: ts,
    conversionValue: e.value,
    currencyCode: e.currency,
    orderId: e.eventId,
    ...(e.clickIdType === 'gclid' && e.clickId ? { gclid: e.clickId } : {}),
    ...(e.hashedEmail || e.hashedPhone
      ? { userIdentifiers: [...(e.hashedEmail ? [{ hashedEmail: e.hashedEmail }] : []), ...(e.hashedPhone ? [{ hashedPhoneNumber: e.hashedPhone }] : [])] }
      : {}),
  };
  const res = await httpJson<{ partialFailureError?: { message: string } }>('GOOGLE', `${googleBase()}:uploadClickConversions`, {
    method: 'POST',
    headers: await googleHeaders(),
    json: { conversions: [conversion], partialFailure: true },
  });
  if (res.partialFailureError) return { destination: d, status: 'failed', detail: res.partialFailureError.message };
  return { destination: d, status: 'sent', detail: 'conversion uploaded' };
}

async function linkedin(e: DispatchEvent): Promise<DispatchResult> {
  const d = 'LINKEDIN_CAPI' as const;
  if (e.clickIdType !== 'li_fat_id' && !e.hashedEmail) return { destination: d, status: 'skipped', detail: 'no li_fat_id or hashed email' };
  if (config.SANDBOX_MODE || !credentials.linkedinCapi) return { destination: d, status: 'simulated', detail: `would POST ${e.eventType} to /rest/conversionEvents` };
  const userIds = [
    ...(e.hashedEmail ? [{ idType: 'SHA256_EMAIL', idValue: e.hashedEmail }] : []),
    ...(e.clickIdType === 'li_fat_id' && e.clickId ? [{ idType: 'LINKEDIN_FIRST_PARTY_ADS_TRACKING_UUID', idValue: e.clickId }] : []),
  ];
  const res = await fetch('https://api.linkedin.com/rest/conversionEvents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.LINKEDIN_ACCESS_TOKEN}`,
      'LinkedIn-Version': config.LINKEDIN_API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversion: `urn:lla:llaPartnerConversion:${config.LINKEDIN_CONVERSION_RULE_ID}`,
      conversionHappenedAt: e.occurredAt.getTime(),
      conversionValue: { currencyCode: e.currency, amount: e.value.toFixed(2) },
      eventId: e.eventId,
      user: { userIds },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return { destination: d, status: 'failed', detail: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
  return { destination: d, status: 'sent', detail: 'conversion event accepted' };
}

/** Send the event to every destination that can match it. Failures are captured, never thrown. */
export async function dispatchConversion(e: DispatchEvent): Promise<DispatchResult[]> {
  const run = async (destination: DispatchResult['destination'], fn: (e: DispatchEvent) => Promise<DispatchResult>) => {
    try {
      return await fn(e);
    } catch (err) {
      return { destination, status: 'failed' as const, detail: err instanceof Error ? err.message : String(err) };
    }
  };
  return Promise.all([run('META_CAPI', meta), run('GOOGLE_ENHANCED_CONVERSIONS', google), run('LINKEDIN_CAPI', linkedin)]);
}
