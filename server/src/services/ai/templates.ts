import type { CampaignObjective, InsuranceClass, Platform } from '@prisma/client';
import { asStringArray, type CreativeContent, type ProductLike } from '../../types.js';
import { licenseDisclosure } from '../compliance/rules.js';

/**
 * Deterministic creative templates. Used when ANTHROPIC_API_KEY isn't set, when Claude fails, and
 * to back-fill Google RSA assets that were dropped for exceeding character limits.
 */

interface ClassPlaybook {
  noun: string; // what is protected
  hooks: { angle: string; headline: string; text: (p: ProductLike, price: string) => string; brief: string }[];
  googleHeadlines: string[]; // all ≤ 30 chars
  googleDescriptions: string[]; // all ≤ 90 chars
  keywords: string[];
  linkedin: { angle: string; text: (p: ProductLike, price: string) => string; jobTitles: string[]; industries: string[] }[];
}

const fmtPrice = (p: ProductLike) => {
  const n = Number(String(p.startingPremium ?? 0));
  return `${p.currency === 'NGN' ? '₦' : p.currency + ' '}${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
};

const PLAYBOOKS: Record<InsuranceClass, ClassPlaybook> = {
  AUTO_MOTOR: {
    noun: 'car',
    hooks: [
      {
        angle: 'Vehicle protection',
        headline: 'Comprehensive Car Cover, Fast',
        text: (p, price) => `Accidents, theft, fire, flood: ${p.name} covers your car and third-party liability from ${price}/year. Get an instant online quote and drive away covered today.`,
        brief: 'Reels (9:16, 15s): dashcam-style POV of a Lagos commute → sudden brake moment → cut to calm claims call and repaired car. End card: price + "Get a quote".',
      },
      {
        angle: 'Cost-savings calculator',
        headline: 'See Your Motor Premium in 60s',
        text: (p, price) => `Compare comprehensive motor cover in under a minute. Plans start from ${price}/year with flexible instalments. Enter your car details and see your price instantly.`,
        brief: 'Carousel (1:1): card 1 "How much is comprehensive cover?" → cards 2-4 sample car models with starting premiums → card 5 quote calculator screenshot.',
      },
      {
        angle: 'New car milestone',
        headline: 'Just Got New Keys? Insure Them',
        text: (p, price) => `New car, new chapter. Protect it from day one with ${p.name}: tracker discounts, towing and 24/7 claims support. Cover from ${price}/year.`,
        brief: 'Reels (9:16, 12s): handing over car keys, family celebrates, slow pan of the car; overlay "Covered from day one".',
      },
    ],
    googleHeadlines: ['Comprehensive Car Insurance', 'Get a Motor Quote in 60s', 'Third-Party & Comprehensive', 'Instalment Payment Options', 'Licensed Insurance Broker', '24/7 Claims Support', 'Compare Top Insurers', 'Towing & Tracker Discounts', 'Buy Car Insurance Online', 'Instant Motor Certificate'],
    googleDescriptions: ['Compare comprehensive and third-party motor cover from top insurers. Buy online today.', 'Accident, theft and fire cover with flexible instalments and fast claims support.', 'Get your quote in under a minute and receive your certificate by email.', 'Licensed broker working for you, not the insurer. Free claims advocacy.'],
    keywords: ['comprehensive car insurance', 'car insurance quote', 'motor insurance nigeria', 'third party car insurance', 'buy car insurance online', 'auto insurance lagos', 'vehicle insurance price', 'car insurance instalment'],
    linkedin: [
      { angle: 'Fleet protection', text: (p, price) => `Running a company fleet? One ${p.name} fleet policy covers every vehicle, driver liability and goods in transit, with a single renewal date. Individual cover from ${price}/year; fleet rates on request.`, jobTitles: ['Fleet Manager', 'Logistics Manager', 'Operations Director', 'Procurement Manager'], industries: ['Logistics', 'Transportation', 'Construction', 'Oil & Energy'] },
    ],
  },
  HEALTH_HMO: {
    noun: 'health',
    hooks: [
      {
        angle: 'Family health access',
        headline: 'Quality Healthcare for the Family',
        text: (p, price) => `${p.name} gives your family access to a wide network of accredited hospitals, outpatient care and specialist consultations. Plans from ${price}/year.`,
        brief: 'Reels (9:16, 15s): parent and child at a bright, modern clinic reception → quick tour of hospital network map → app showing e-card. End card: "Plans from {price}".',
      },
      {
        angle: 'Cost-savings calculator',
        headline: 'Compare HMO Plans in Minutes',
        text: (p, price) => `Hospital bills add up fast. Compare HMO plans side by side, see what each covers and start from ${price}/year with monthly payment options.`,
        brief: 'Carousel (1:1): card 1 "What does an HMO plan cover?" → cards for outpatient, admission, maternity, dental → final card plan comparison table.',
      },
      {
        angle: 'Career milestone',
        headline: 'New Job? Sort Your Health Cover',
        text: (p, price) => `Starting a new role or going freelance? Keep quality healthcare in place with ${p.name}: individual and family plans from ${price}/year.`,
        brief: 'Static + Reels: young professional on first day at work, then cut to HMO e-card on phone. Calm, optimistic tone; no hospital-bed imagery.',
      },
    ],
    googleHeadlines: ['Compare HMO Health Plans', 'Family Health Insurance', 'Wide Hospital Network', 'Monthly Payment Options', 'Get an HMO Quote Today', 'Corporate HMO Plans', 'Outpatient & Specialist Care', 'Licensed Insurance Broker', 'Plans for Individuals', 'Buy Health Cover Online'],
    googleDescriptions: ['Compare HMO plans from accredited providers. Outpatient, admission and specialist care.', 'Individual, family and corporate plans with monthly payment options. Quote in minutes.', 'Access a wide network of accredited hospitals with a digital membership card.', 'Independent licensed broker. We help you choose the right plan and handle claims.'],
    keywords: ['hmo plans nigeria', 'health insurance lagos', 'family health insurance', 'best hmo for family', 'corporate hmo plan', 'health insurance quote', 'individual health insurance', 'hmo price list'],
    linkedin: [
      { angle: 'Corporate HMO for retention', text: (p, price) => `Healthcare is one of the benefits employees value most. ${p.name} corporate plans give your team access to accredited hospitals, telemedicine and annual checks, with group rates and one consolidated invoice. Plans from ${price} per employee/year.`, jobTitles: ['HR Manager', 'Head of People', 'Compensation & Benefits Manager', 'Chief Financial Officer', 'Managing Director'], industries: ['Financial Services', 'Information Technology', 'Professional Services', 'Telecommunications', 'Manufacturing'] },
    ],
  },
  LIFE: {
    noun: 'family',
    hooks: [
      {
        angle: 'Family protection',
        headline: "Protect Your Family's Future",
        text: (p, price) => `${p.name} pays a lump sum to your loved ones if the unexpected happens, helping cover school fees, rent and everyday costs. Cover from ${price}/year.`,
        brief: 'Reels (9:16, 20s): family morning routine, school run, dinner table. Voiceover on keeping plans on track. End card: "Cover from {price}/year".',
      },
      {
        angle: 'Cost-savings calculator',
        headline: 'How Much Life Cover Do You Need?',
        text: (p, price) => `Use our 2-minute calculator to estimate the right amount of term life cover for your household. Premiums start from ${price}/year.`,
        brief: 'Carousel: card 1 calculator question → cards showing sample cover amounts by household size → final card CTA to calculator.',
      },
      {
        angle: 'Life milestone',
        headline: 'Married or New Baby? Plan Ahead',
        text: (p, price) => `Big life moments are the right time to put protection in place. ${p.name} term cover from ${price}/year, simple online application.`,
        brief: 'Reels: wedding and newborn moments, warm tones, text overlay "New chapter, new plans".',
      },
    ],
    googleHeadlines: ['Term Life Insurance', 'Protect Your Family', 'Life Cover Calculator', 'Get a Life Quote Online', 'Affordable Term Cover', 'Simple Online Application', 'Licensed Insurance Broker', 'Compare Life Insurers', 'Flexible Cover Amounts', 'Speak to an Adviser'],
    googleDescriptions: ['Compare term life insurance from leading insurers. Choose your cover amount and term.', 'Estimate how much life cover your family needs with our free 2-minute calculator.', 'Simple online application and independent advice from a licensed broker.', 'Lump-sum cover to help your family with school fees, rent and daily costs.'],
    keywords: ['term life insurance', 'life insurance nigeria', 'life insurance quote', 'family life cover', 'life insurance calculator', 'buy life insurance online', 'affordable life insurance'],
    linkedin: [
      { angle: 'Group life for employers', text: (p, price) => `Group life cover is a statutory requirement under the Pension Reform Act for employers. ${p.name} group plans keep your company compliant and give staff families real protection. Individual cover from ${price}/year.`, jobTitles: ['HR Manager', 'Head of People', 'Chief Financial Officer', 'Company Secretary'], industries: ['Financial Services', 'Oil & Energy', 'Manufacturing', 'Professional Services'] },
    ],
  },
  PROPERTY: {
    noun: 'home',
    hooks: [
      {
        angle: 'Home & contents protection',
        headline: 'Cover Your Home and Valuables',
        text: (p, price) => `Fire, flood, burglary and accidental damage: ${p.name} protects your building and contents from ${price}/year. Get a quote online in minutes.`,
        brief: 'Reels (9:16, 15s): walkthrough of a cosy apartment, highlight TV, generator, jewellery box → overlay "All covered". End card with price.',
      },
      {
        angle: 'Cost-savings calculator',
        headline: 'What Does Home Cover Cost?',
        text: (p, price) => `Home insurance costs less than most people expect. Enter your property value and see your price; plans start from ${price}/year.`,
        brief: 'Carousel: property value slider screenshot → sample premiums for flat, duplex, shop → CTA card.',
      },
      {
        angle: 'New home milestone',
        headline: 'New Home? Protect It From Day 1',
        text: (p, price) => `Just moved in or bought your first property? ${p.name} covers the building and everything inside it from ${price}/year.`,
        brief: 'Reels: keys turning in a front door, boxes being unpacked, family settling in. Warm, aspirational tone.',
      },
    ],
    googleHeadlines: ['Home Insurance Quotes', 'Cover Building & Contents', 'Fire, Flood & Burglary Cover', 'Get a Home Quote Online', 'Landlord Insurance Plans', 'Licensed Insurance Broker', 'Compare Home Insurers', 'Protect Your Valuables', 'Fast Claims Support', 'Tenant Contents Cover'],
    googleDescriptions: ['Protect your building and contents against fire, flood, burglary and accidental damage.', 'Get a home insurance quote online in minutes. Plans for owners, landlords and tenants.', 'Independent licensed broker comparing leading insurers. We support you through claims.', 'Add cover for jewellery, electronics and generators with flexible payment options.'],
    keywords: ['home insurance nigeria', 'house insurance quote', 'fire and burglary insurance', 'building insurance lagos', 'contents insurance', 'landlord insurance', 'property insurance price'],
    linkedin: [
      { angle: 'Commercial property', text: (p, price) => `Protect offices, warehouses and stock against fire, flood and burglary. ${p.name} business property cover is tailored to your assets; quotes in 24 hours. From ${price}/year.`, jobTitles: ['Facilities Manager', 'Property Manager', 'Chief Financial Officer', 'Operations Director'], industries: ['Real Estate', 'Retail', 'Warehousing', 'Hospitality'] },
    ],
  },
  COMMERCIAL_SME: {
    noun: 'business',
    hooks: [
      {
        angle: 'Business asset protection',
        headline: 'Insurance Built for SMEs',
        text: (p, price) => `Stock, equipment, cash and public liability in one simple package. ${p.name} keeps your business trading after the unexpected, from ${price}/year.`,
        brief: 'Reels (9:16, 15s): shop owner opening shutters, staff serving customers, stock room. Overlay key covers. End card with price.',
      },
      {
        angle: 'Cost-savings calculator',
        headline: 'Bundle Your Business Covers',
        text: (p, price) => `Paying for several separate policies? Bundling fire, burglary, money and liability cover can lower your total premium. Packages from ${price}/year.`,
        brief: 'Carousel: card per cover (fire, burglary, money, liability) → final card "One package, one renewal".',
      },
      {
        angle: 'Business milestone',
        headline: 'Opening a New Branch? Get Covered',
        text: (p, price) => `Expanding to a new location or signing a big contract? Many clients require proof of insurance. Get SME cover certificates fast with ${p.name}, from ${price}/year.`,
        brief: 'Static/Reels: ribbon cutting at a new shop, contract signing, certificate PDF on phone.',
      },
    ],
    googleHeadlines: ['SME Business Insurance', 'Public Liability Cover', 'Insure Stock & Equipment', 'Get a Business Quote', 'One Package, One Renewal', 'Licensed Insurance Broker', 'Contract Insurance Certs', 'Money & Burglary Cover', 'Cover for Shops & Offices', 'Fast Business Quotes'],
    googleDescriptions: ['Package cover for stock, equipment, cash and public liability. Built for SMEs.', 'Get insurance certificates for tenders and contracts quickly from a licensed broker.', 'Bundle fire, burglary, money and liability cover into one policy with one renewal.', 'Independent advice and claims advocacy for small and growing businesses.'],
    keywords: ['sme insurance nigeria', 'business insurance quote', 'public liability insurance', 'shop insurance', 'small business insurance', 'goods in transit insurance', 'office insurance'],
    linkedin: [
      { angle: 'Contract & liability readiness', text: (p, price) => `Tenders and enterprise clients increasingly require proof of public liability, professional indemnity and employer's liability cover. ${p.name} packages the essentials with fast certificate issuance. From ${price}/year.`, jobTitles: ['Founder', 'Managing Director', 'Chief Operating Officer', 'Finance Manager', 'Procurement Manager'], industries: ['Construction', 'Professional Services', 'Information Technology', 'Retail', 'Manufacturing'] },
      { angle: 'Risk management for growth', text: (p, price) => `Growing businesses face growing risks. Get a free risk review and a tailored SME insurance package from a licensed broker. Packages from ${price}/year.`, jobTitles: ['Chief Executive Officer', 'Chief Financial Officer', 'Risk Manager'], industries: ['Financial Services', 'Logistics', 'Hospitality', 'Healthcare'] },
    ],
  },
  TRAVEL: {
    noun: 'trip',
    hooks: [
      {
        angle: 'Trip protection',
        headline: 'Travel Insurance for Your Visa',
        text: (p, price) => `Schengen, UK and worldwide plans with emergency medical cover, trip cancellation and lost baggage. Certificates issued instantly, from ${price}.`,
        brief: 'Reels (9:16, 12s): passport stamping, airport departure board, arrival at destination. Overlay "Visa-ready certificate in minutes".',
      },
      {
        angle: 'Cost-savings calculator',
        headline: 'Compare Travel Plans by Trip',
        text: (p, price) => `Price your trip in seconds: choose destination and dates and compare plans side by side. Single-trip and annual multi-trip from ${price}.`,
        brief: 'Carousel: destination cards (Schengen, UK, USA, Dubai) with starting prices → final CTA card.',
      },
      {
        angle: 'Study/relocation milestone',
        headline: 'Studying Abroad? Get Covered',
        text: (p, price) => `Heading abroad for study or work? ${p.name} offers long-stay plans that meet visa requirements, from ${price}.`,
        brief: 'Reels: student with luggage, campus arrival, video call home. Bright, optimistic tone.',
      },
    ],
    googleHeadlines: ['Schengen Travel Insurance', 'Instant Visa Certificates', 'Worldwide Travel Cover', 'Compare Travel Plans', 'Student Travel Insurance', 'Annual Multi-Trip Cover', 'Licensed Insurance Broker', 'Emergency Medical Abroad', 'Buy Travel Cover Online', 'UK Visa Travel Insurance'],
    googleDescriptions: ['Visa-compliant travel insurance for Schengen, UK and worldwide trips. Instant certificate.', 'Emergency medical, trip cancellation and lost baggage cover. Compare plans in seconds.', 'Single-trip, annual multi-trip and student plans from a licensed broker.', 'Buy online and receive your certificate by email in minutes.'],
    keywords: ['travel insurance nigeria', 'schengen travel insurance', 'travel insurance for visa', 'uk visa travel insurance', 'student travel insurance', 'travel insurance price', 'buy travel insurance online'],
    linkedin: [
      { angle: 'Corporate travel', text: (p, price) => `Keep business travellers protected with annual corporate travel cover: emergency medical, evacuation and trip disruption for every employee on one policy. Single trips from ${price}.`, jobTitles: ['Travel Manager', 'HR Manager', 'Office Manager', 'Chief Operating Officer'], industries: ['Oil & Energy', 'Consulting', 'Financial Services', 'Non-profit'] },
    ],
  },
};

const CTA_BY_OBJECTIVE: Record<CampaignObjective, { meta: string; linkedin: string }> = {
  TRAFFIC: { meta: 'LEARN_MORE', linkedin: 'LEARN_MORE' },
  QUOTE_LEADS: { meta: 'GET_QUOTE', linkedin: 'REQUEST_DEMO' },
  POLICY_PURCHASE: { meta: 'APPLY_NOW', linkedin: 'APPLY' },
};

export function templateCreatives(product: ProductLike, objective: CampaignObjective, platforms: Platform[]): CreativeContent[] {
  const pb = PLAYBOOKS[product.insuranceClass];
  const price = fmtPrice(product);
  const disclosure = licenseDisclosure(product.regulatoryLicenseNumber);
  const benefits = asStringArray(product.keyBenefits);
  const out: CreativeContent[] = [];

  for (const platform of platforms) {
    if (platform === 'FACEBOOK' || platform === 'INSTAGRAM') {
      for (const h of pb.hooks) {
        const body = h.text(product, price);
        const bullets = benefits.slice(0, 3).map((b) => `✓ ${b}`).join('\n');
        out.push({
          platform,
          hookAngle: h.angle,
          headlines: [h.headline],
          primaryTexts: [`${body}${bullets ? `\n\n${bullets}` : ''}\n\n${disclosure}`],
          descriptions: [`Plans from ${price}. Licensed broker.`],
          callToAction: CTA_BY_OBJECTIVE[objective].meta,
          mediaBriefOrUrl: platform === 'INSTAGRAM' ? h.brief.replace('{price}', price) : h.brief.replace('{price}', price).replace(/^Reels \(9:16/, 'Feed video (4:5'),
        });
      }
    } else if (platform === 'GOOGLE_SEARCH') {
      out.push({
        platform,
        hookAngle: 'High-intent search',
        headlines: pb.googleHeadlines.slice(0, 10),
        primaryTexts: [],
        descriptions: pb.googleDescriptions.slice(0, 4),
        callToAction: 'GET_QUOTE',
        keywords: pb.keywords,
        mediaBriefOrUrl: null,
      });
    } else if (platform === 'GOOGLE_DISPLAY') {
      out.push({
        platform,
        hookAngle: 'Remarketing display',
        headlines: pb.googleHeadlines.slice(0, 5),
        primaryTexts: [],
        descriptions: pb.googleDescriptions.slice(0, 4),
        callToAction: 'GET_QUOTE',
        mediaBriefOrUrl: `Responsive display assets: 1200x628 and 1200x1200 lifestyle images of a protected ${pb.noun}, square logo 1200x1200, brand colour background. Starting price ${price}.`,
      });
    } else if (platform === 'LINKEDIN') {
      for (const l of pb.linkedin) {
        out.push({
          platform,
          hookAngle: l.angle,
          headlines: [`${product.name}: ${l.angle}`.slice(0, 70)],
          primaryTexts: [`${l.text(product, price)}\n\n${disclosure}`],
          descriptions: ['Speak to a licensed broker today.'],
          callToAction: CTA_BY_OBJECTIVE[objective].linkedin,
          targetingSuggestions: { jobTitles: l.jobTitles, industries: l.industries, companySizes: ['11-50', '51-200', '201-500', '501-1000'] },
          mediaBriefOrUrl: 'Single image (1200x627): professional team in a modern Lagos office; overlay key benefit + logo. Optional document ad: one-page benefits summary PDF.',
        });
      }
    }
  }
  return out;
}

export const googleBackfill = (cls: InsuranceClass) => ({ headlines: PLAYBOOKS[cls].googleHeadlines, descriptions: PLAYBOOKS[cls].googleDescriptions });
