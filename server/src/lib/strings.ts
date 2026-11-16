export const slugify = (s: string, max = 60) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');

export const buildUtmCampaign = (campaignId: number, name: string) => `ins-${campaignId}-${slugify(name, 40)}`;

/** Trim text to `max` chars at a word boundary (no ellipsis — ad platforms count every char). */
export function trimToLimit(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(' ');
  const out = (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : t.slice(0, max)).replace(/[\s,;:–-]+$/u, '');
  return out.length <= max ? out : out.slice(0, max);
}

export function appendQuery(url: string, params: Record<string, string>): string {
  try {
    const u = new URL(url);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return u.toString();
  } catch {
    const qs = new URLSearchParams(params).toString();
    return url + (url.includes('?') ? '&' : '?') + qs;
  }
}
