// Shared constants used by both the React client and the Node server.
// Keep this file dependency-free (plain ESM) so Vite and Node can both import it.

export const REGULATORY_FRAMEWORK = 'NAICOM & Nigerian Insurance Industry Reform Act 2025';

export const DEFAULT_DISCLAIMER =
  'This book is published for general educational purposes only. It does not constitute insurance, legal, tax or ' +
  'financial advice, and it is not an offer to sell or bind any insurance policy. Cover, exclusions, premiums and ' +
  'claim outcomes depend on the actual policy wording, the underwriting information you disclose and the terms of the ' +
  'insurer that issues the policy. Statutory references reflect the author’s understanding of the Nigerian Insurance ' +
  'Industry Reform Act 2025 (NIIRA 2025), the rules and guidelines of the National Insurance Commission (NAICOM) and ' +
  'related legislation at the time of writing; readers should confirm current requirements with NAICOM, a licensed ' +
  'insurance broker or a qualified professional before acting. Case studies are illustrative composites with names and ' +
  'details changed; figures are examples, not guarantees. Insurance brokerage services referenced in this book are ' +
  'provided by the author’s brokerage, which is licensed by NAICOM. No insurer is obliged to pay any claim outside the ' +
  'terms of its policy, and premium must be paid before cover attaches ("No Premium, No Cover").';

export const CURRENCIES = {
  NGN: { code: 'NGN', symbol: '₦', locale: 'en-NG' },
  USD: { code: 'USD', symbol: '$', locale: 'en-US' },
};

export function fmtMoney(amount, currency = 'NGN', { decimals = 0 } = {}) {
  const c = CURRENCIES[currency] || CURRENCIES.NGN;
  const n = Number(amount || 0);
  const s = n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (n < 0 ? '-' : '') + c.symbol + s.replace('-', '');
}

// Trim sizes in inches. Margins are inside/outside/top/bottom in inches (print layout).
export const TRIM_SIZES = {
  '5.5x8.5': { id: '5.5x8.5', label: '5.5" × 8.5" Digest', width: 5.5, height: 8.5, margins: { top: 0.75, bottom: 0.75, inside: 0.75, outside: 0.6 } },
  '6x9': { id: '6x9', label: '6" × 9" Trade Paperback', width: 6, height: 9, margins: { top: 0.8, bottom: 0.8, inside: 0.8, outside: 0.65 } },
  A5: { id: 'A5', label: 'A5 Paperback (148 × 210 mm)', width: 5.827, height: 8.268, margins: { top: 0.75, bottom: 0.75, inside: 0.75, outside: 0.6 } },
  A4: { id: 'A4', label: 'A4 Workbook (210 × 297 mm)', width: 8.268, height: 11.693, margins: { top: 1, bottom: 1, inside: 1, outside: 0.85 } },
};

export const SECTION_TYPES = [
  { id: 'front_matter', label: 'Front Matter' },
  { id: 'body', label: 'Chapters' },
  { id: 'workbook', label: 'Workbooks & Checklists' },
  { id: 'back_matter', label: 'Back Matter' },
];

export const MATTER_SUBTYPES = {
  title_page: 'Title Page',
  copyright: 'Copyright & Regulatory Disclaimer',
  dedication: 'Dedication',
  who_this_is_for: 'Who This Book Is For',
  introduction: 'Introduction',
  chapter: 'Chapter',
  case_study: 'Case Study',
  checklist: 'Checklist',
  worksheet: 'Worksheet',
  glossary: 'Glossary',
  claims_directory: 'Claims Readiness Directory',
  about_author: 'About the Author',
  next_steps: 'Next Steps / Offer',
};

export const CHAPTER_STATUSES = ['outline', 'drafting', 'polishing', 'complete'];

export const AUDIENCES = [
  { id: 'sme', label: 'Nigerian SMEs & Retail/Warehouse Owners', icon: 'Store' },
  { id: 'fleet', label: 'Commercial Fleet & Logistics Operators', icon: 'Truck' },
  { id: 'hr', label: 'HR Managers (Statutory Group Life & Employee Benefits)', icon: 'Users' },
  { id: 'families', label: 'Young Parents & Families', icon: 'Baby' },
  { id: 'property', label: 'Homeowners, Landlords & Builders (Occupiers & Builders Liability)', icon: 'Building2' },
  { id: 'diaspora', label: 'Diaspora Property & Asset Investors', icon: 'Plane' },
  { id: 'hnw', label: 'High-Net-Worth Professionals', icon: 'Gem' },
];

export const CTA_TYPES = {
  selar_checkout: { label: 'Selar Checkout', hint: 'https://selar.co/your-product' },
  paystack_link: { label: 'Paystack Payment Link', hint: 'https://paystack.com/pay/your-page' },
  whatsapp_quote: { label: 'WhatsApp Instant Quote', hint: 'https://wa.me/234XXXXXXXXXX' },
  policy_audit: { label: 'Free Policy Gap Audit', hint: 'https://yourbrokerage.ng/audit' },
  calculator: { label: 'Online Calculator', hint: 'https://yourbrokerage.ng/calculator' },
  lead_magnet: { label: 'Lead Magnet Download', hint: 'https://yourbrokerage.ng/free-checklist' },
};

// Builds the final URL a CTA/QR should point to (adds WhatsApp prefill + UTM tracking).
export function buildCtaUrl(cta, { bookId, source = 'book' } = {}) {
  if (!cta || !cta.destination_url) return '';
  let url = String(cta.destination_url).trim();
  if (cta.cta_type === 'whatsapp_quote') {
    const m = url.match(/wa\.me\/(\+?\d+)/) || url.match(/^\+?(\d{8,15})$/);
    const phone = m ? m[1].replace('+', '') : url.replace(/\D/g, '');
    const text = cta.whatsapp_prefill_text ? `?text=${encodeURIComponent(cta.whatsapp_prefill_text)}` : '';
    return `https://wa.me/${phone}${text}`;
  }
  try {
    const u = new URL(url);
    if (!u.searchParams.has('utm_source')) {
      u.searchParams.set('utm_source', 'insurepress');
      u.searchParams.set('utm_medium', source);
      if (bookId) u.searchParams.set('utm_campaign', `book-${bookId}`);
    }
    if (cta.promo_code && !u.searchParams.has('coupon')) u.searchParams.set('coupon', cta.promo_code);
    return u.toString();
  } catch {
    return url;
  }
}

export const GOOGLE_FONTS = [
  'Merriweather', 'Inter', 'Lora', 'Source Serif 4', 'Playfair Display', 'Libre Baskerville',
  'Poppins', 'Montserrat', 'DM Sans', 'Nunito Sans', 'EB Garamond', 'Work Sans',
];

export function googleFontsHref(fonts) {
  const uniq = [...new Set(fonts.filter((f) => GOOGLE_FONTS.includes(f)))];
  if (!uniq.length) return '';
  const fam = uniq.map((f) => `family=${f.replace(/ /g, '+')}:ital,wght@0,400;0,600;0,700;1,400`).join('&');
  return `https://fonts.googleapis.com/css2?${fam}&display=swap`;
}
