/**
 * Seeds: insurance products across all 6 classes, default optimization rules, and (sandbox) demo
 * campaigns with 30 days of synthetic performance + conversion events so the dashboard is populated.
 * Idempotent: wipes the demo data it owns and recreates it.
 */
import { PrismaClient, Prisma, type InsuranceClass, type Platform, type CampaignObjective } from '@prisma/client';
import { templateCreatives } from '../src/services/ai/templates.js';
import { normalise } from '../src/services/ai/creativeGenerator.js';
import { validateCopy, overallStatus, resolveSpecialAdCategory } from '../src/services/compliance/rules.js';
import { simulateDay } from '../src/services/platforms/sandbox.js';
import { buildUtmCampaign } from '../src/lib/strings.js';
import { hashPassword } from '../src/services/auth/password.js';

const prisma = new PrismaClient();

const PRODUCTS: {
  insuranceClass: InsuranceClass;
  name: string;
  targetAudienceSummary: string;
  keyBenefits: string[];
  startingPremium: string;
  landingPageUrl: string;
  regulatoryLicenseNumber: string;
}[] = [
  {
    insuranceClass: 'AUTO_MOTOR',
    name: 'DriveSafe Comprehensive Motor',
    targetAudienceSummary: 'Private car owners aged 25–55 in Lagos, Abuja and Port Harcourt; new and used vehicle buyers; ride-hailing drivers.',
    keyBenefits: ['Own damage, theft and fire cover', 'Third-party bodily injury & property damage', 'Free tracker discount up to 10%', '24/7 towing & claims hotline', 'Pay in up to 4 instalments'],
    startingPremium: '75000.00',
    landingPageUrl: 'https://quotes.example-broker.ng/motor',
    regulatoryLicenseNumber: 'NAICOM/IB/2019/0457',
  },
  {
    insuranceClass: 'AUTO_MOTOR',
    name: 'Third-Party Motor Plus',
    targetAudienceSummary: 'Budget-conscious car and bus owners who need statutory third-party cover plus limited own damage.',
    keyBenefits: ['Statutory third-party liability', 'Own damage up to ₦500,000', 'Instant digital certificate'],
    startingPremium: '15000.00',
    landingPageUrl: 'https://quotes.example-broker.ng/third-party',
    regulatoryLicenseNumber: 'NAICOM/IB/2019/0457',
  },
  {
    insuranceClass: 'HEALTH_HMO',
    name: 'CareFirst Family HMO',
    targetAudienceSummary: 'Young families and self-employed professionals wanting private healthcare access for 2–6 people.',
    keyBenefits: ['1,200+ accredited hospitals nationwide', 'Outpatient, admission & specialist care', 'Maternity & paediatric care', 'Telemedicine 24/7', 'Monthly payment option'],
    startingPremium: '120000.00',
    landingPageUrl: 'https://quotes.example-broker.ng/health-family',
    regulatoryLicenseNumber: 'NAICOM/IB/2019/0457 · NHIA/HMO/0213',
  },
  {
    insuranceClass: 'HEALTH_HMO',
    name: 'CareFirst Corporate HMO',
    targetAudienceSummary: 'HR and finance leaders at SMEs and corporates (10–1,000 employees) buying group health plans.',
    keyBenefits: ['Group rates from 10 employees', 'Annual health checks', 'Dedicated account manager', 'Consolidated monthly invoicing'],
    startingPremium: '85000.00',
    landingPageUrl: 'https://quotes.example-broker.ng/health-corporate',
    regulatoryLicenseNumber: 'NAICOM/IB/2019/0457 · NHIA/HMO/0213',
  },
  {
    insuranceClass: 'LIFE',
    name: 'Legacy Term Life',
    targetAudienceSummary: 'Parents and breadwinners aged 28–55 with dependants, mortgages or school fees to protect.',
    keyBenefits: ['Lump-sum cover from ₦5m to ₦200m', 'Terms of 5–30 years', 'Simple online application', 'Accidental death benefit included'],
    startingPremium: '36000.00',
    landingPageUrl: 'https://quotes.example-broker.ng/term-life',
    regulatoryLicenseNumber: 'NAICOM/IB/2019/0457',
  },
  {
    insuranceClass: 'PROPERTY',
    name: 'HomeShield Building & Contents',
    targetAudienceSummary: 'Homeowners, landlords and tenants in major cities protecting buildings, generators, electronics and valuables.',
    keyBenefits: ['Fire, flood & storm damage', 'Burglary & theft of contents', 'Accidental damage to electronics', 'Alternative accommodation cover'],
    startingPremium: '25000.00',
    landingPageUrl: 'https://quotes.example-broker.ng/home',
    regulatoryLicenseNumber: 'NAICOM/IB/2019/0457',
  },
  {
    insuranceClass: 'COMMERCIAL_SME',
    name: 'BizGuard SME Package',
    targetAudienceSummary: 'Owners and managers of shops, offices, restaurants and light manufacturers with 2–200 staff.',
    keyBenefits: ['Fire & burglary for stock and equipment', 'Money in transit & in safe', 'Public liability', "Employer's liability", 'Fast certificates for tenders'],
    startingPremium: '95000.00',
    landingPageUrl: 'https://quotes.example-broker.ng/sme',
    regulatoryLicenseNumber: 'NAICOM/IB/2019/0457',
  },
  {
    insuranceClass: 'TRAVEL',
    name: 'Journey Travel Insurance',
    targetAudienceSummary: 'Visa applicants, students and business travellers heading to Schengen, UK, US and worldwide destinations.',
    keyBenefits: ['Schengen & UK visa-compliant', 'Emergency medical up to €50,000', 'Trip cancellation & lost baggage', 'Instant certificate by email'],
    startingPremium: '12500.00',
    landingPageUrl: 'https://quotes.example-broker.ng/travel',
    regulatoryLicenseNumber: 'NAICOM/IB/2019/0457',
  },
];

const RULES: { name: string; ruleType: 'PAUSE_ZERO_QUOTES' | 'SCALE_HIGH_ROAS' | 'FLAG_HIGH_CPA'; spendThreshold: string; targetRoas?: string; maxCostPerPolicy?: string; budgetIncreasePct?: number; lookbackDays: number; mode: 'RECOMMEND' | 'AUTO_APPLY' }[] = [
  { name: 'Pause deployments spending ≥ ₦50,000 with 0 quotes (7d)', ruleType: 'PAUSE_ZERO_QUOTES', spendThreshold: '50000.00', lookbackDays: 7, mode: 'RECOMMEND' },
  { name: 'Scale winners: +15% budget when Policy ROAS ≥ 4x (7d)', ruleType: 'SCALE_HIGH_ROAS', spendThreshold: '30000.00', targetRoas: '4.00', budgetIncreasePct: 15, lookbackDays: 7, mode: 'RECOMMEND' },
  { name: 'Flag cost per policy above ₦60,000 (14d)', ruleType: 'FLAG_HIGH_CPA', spendThreshold: '20000.00', maxCostPerPolicy: '60000.00', lookbackDays: 14, mode: 'RECOMMEND' },
];

const DEMO: { product: string; name: string; objective: CampaignObjective; budget: number; split: Partial<Record<Platform, number>>; regions: string[]; status: 'ACTIVE' | 'PAUSED' }[] = [
  { product: 'DriveSafe Comprehensive Motor', name: 'Motor Q4 – Lagos & Abuja', objective: 'POLICY_PURCHASE', budget: 150000, split: { FACEBOOK: 30, INSTAGRAM: 20, GOOGLE_SEARCH: 50 }, regions: ['Lagos', 'Federal Capital Territory'], status: 'ACTIVE' },
  { product: 'CareFirst Family HMO', name: 'Family HMO – Always On', objective: 'QUOTE_LEADS', budget: 120000, split: { FACEBOOK: 40, INSTAGRAM: 30, GOOGLE_SEARCH: 30 }, regions: ['Lagos', 'Rivers', 'Oyo'], status: 'ACTIVE' },
  { product: 'BizGuard SME Package', name: 'SME Package – Decision Makers', objective: 'QUOTE_LEADS', budget: 100000, split: { LINKEDIN: 60, GOOGLE_SEARCH: 40 }, regions: ['Lagos', 'Federal Capital Territory'], status: 'ACTIVE' },
  { product: 'Journey Travel Insurance', name: 'Travel – Visa Season', objective: 'POLICY_PURCHASE', budget: 60000, split: { GOOGLE_SEARCH: 60, GOOGLE_DISPLAY: 15, INSTAGRAM: 25 }, regions: [], status: 'ACTIVE' },
  { product: 'Legacy Term Life', name: 'Term Life – Young Families', objective: 'QUOTE_LEADS', budget: 50000, split: { FACEBOOK: 70, LINKEDIN: 30 }, regions: [], status: 'PAUSED' },
];

/**
 * Demo users. Created only if missing (re-seeding never resets a password). Every seeded account
 * must change its password at first sign-in.
 */
async function seedUsers() {
  const password = process.env.SEED_USER_PASSWORD || 'ChangeMe-2026';
  const users = [
    { email: (process.env.SEED_ADMIN_EMAIL || 'admin@example.com').toLowerCase(), name: 'Admin', role: 'ADMIN' as const },
    { email: 'marketer@example.com', name: 'Marketing Manager', role: 'MARKETER' as const },
    { email: 'viewer@example.com', name: 'Read-only Analyst', role: 'VIEWER' as const },
  ];
  const created: string[] = [];
  for (const u of users) {
    if (await prisma.user.findUnique({ where: { email: u.email } })) continue;
    await prisma.user.create({ data: { ...u, passwordHash: await hashPassword(password), mustChangePassword: true } });
    created.push(`${u.email} (${u.role})`);
  }
  if (created.length) console.log(`  users created: ${created.join(', ')} — temporary password "${password}" (must be changed at first sign-in)`);
  else console.log('  users: already present, left unchanged');
}

async function main() {
  console.log('Seeding…');
  await seedUsers();
  // Wipe in FK-safe order.
  await prisma.optimizationRecommendation.deleteMany();
  await prisma.optimizationRule.deleteMany();
  await prisma.conversionEvent.deleteMany();
  await prisma.performanceMetric.deleteMany();
  await prisma.platformDeployment.deleteMany();
  await prisma.adCreativeVariant.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.insuranceProduct.deleteMany();

  const products = [];
  for (const p of PRODUCTS) products.push(await prisma.insuranceProduct.create({ data: { ...p, startingPremium: new Prisma.Decimal(p.startingPremium) } }));
  console.log(`  ${products.length} insurance products`);

  for (const r of RULES)
    await prisma.optimizationRule.create({
      data: {
        name: r.name,
        ruleType: r.ruleType,
        mode: r.mode,
        lookbackDays: r.lookbackDays,
        budgetIncreasePct: r.budgetIncreasePct ?? 15,
        spendThreshold: new Prisma.Decimal(r.spendThreshold),
        targetRoas: r.targetRoas ? new Prisma.Decimal(r.targetRoas) : null,
        maxCostPerPolicy: r.maxCostPerPolicy ? new Prisma.Decimal(r.maxCostPerPolicy) : null,
      },
    });
  console.log(`  ${RULES.length} optimization rules`);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  let metricRows = 0;
  let events = 0;

  for (const demo of DEMO) {
    const product = products.find((p) => p.name === demo.product)!;
    const platforms = Object.keys(demo.split) as Platform[];
    const sac = resolveSpecialAdCategory(product.insuranceClass, platforms);
    const campaign = await prisma.campaign.create({
      data: {
        productId: product.id,
        name: demo.name,
        objective: demo.objective,
        totalDailyBudget: new Prisma.Decimal(demo.budget),
        currency: 'NGN',
        status: demo.status,
        targetLocations: { countries: ['NG'], ...(demo.regions.length ? { regions: demo.regions } : {}) },
        specialAdCategory: sac,
        createdAt: new Date(today.getTime() - 32 * 86400_000),
      },
    });
    await prisma.campaign.update({ where: { id: campaign.id }, data: { utmCampaign: buildUtmCampaign(campaign.id, campaign.name) } });

    const creatives = normalise(templateCreatives(product, demo.objective, platforms), { product });
    const selected = new Map<Platform, number>();
    for (const c of creatives) {
      const findings = validateCopy(c, product.regulatoryLicenseNumber);
      const v = await prisma.adCreativeVariant.create({
        data: {
          campaignId: campaign.id,
          platform: c.platform,
          hookAngle: c.hookAngle,
          headlines: c.headlines,
          primaryTexts: c.primaryTexts,
          descriptions: c.descriptions,
          callToAction: c.callToAction,
          mediaBriefOrUrl: c.mediaBriefOrUrl ?? null,
          keywords: c.keywords ?? Prisma.JsonNull,
          targetingSuggestions: c.targetingSuggestions ?? Prisma.JsonNull,
          complianceStatus: overallStatus(findings),
          complianceNotes: findings as unknown as Prisma.InputJsonValue,
          isSelected: !selected.has(c.platform),
        },
      });
      if (!selected.has(c.platform)) selected.set(c.platform, v.id);
    }

    // budget split in cents so it sums exactly
    let allocated = 0;
    const totalCents = demo.budget * 100;
    for (const [i, platform] of platforms.entries()) {
      const cents = i === platforms.length - 1 ? totalCents - allocated : Math.floor((totalCents * demo.split[platform]!) / 100);
      allocated += cents;
      const prefix = { FACEBOOK: 'fb', INSTAGRAM: 'ig', GOOGLE_SEARCH: 'gs', GOOGLE_DISPLAY: 'gd', LINKEDIN: 'li' }[platform];
      const dep = await prisma.platformDeployment.create({
        data: {
          campaignId: campaign.id,
          platform,
          variantId: selected.get(platform) ?? null,
          externalCampaignId: `sbx_${prefix}_c${campaign.id}`,
          externalAdsetId: `sbx_${prefix}_s${campaign.id}`,
          externalAdId: `sbx_${prefix}_a${campaign.id}`,
          dailyBudget: new Prisma.Decimal(cents / 100),
          status: demo.status,
          lastSyncedAt: new Date(),
        },
      });

      // 30 days of history (the paused campaign ran for its first 20 days).
      const activeDays = demo.status === 'ACTIVE' ? 30 : 20;
      for (let back = 30; back > 30 - activeDays; back--) {
        const date = new Date(today.getTime() - back * 86400_000);
        const m = simulateDay(platform, product.insuranceClass, cents / 100, Number(product.startingPremium), date.toISOString().slice(0, 10), dep.externalCampaignId!);
        await prisma.performanceMetric.create({
          data: {
            deploymentId: dep.id,
            metricDate: date,
            impressions: m.impressions,
            clicks: m.clicks,
            spend: new Prisma.Decimal(m.spend.toFixed(2)),
            quotesStarted: m.quotesStarted,
            policiesSold: m.policiesSold,
            revenueGenerated: new Prisma.Decimal(m.revenue.toFixed(2)),
          },
        });
        metricRows++;
        // A sample of matching conversion events so the conversions log isn't empty.
        if (back <= 7 && m.policiesSold > 0) {
          const clickIdType = platform === 'LINKEDIN' ? 'li_fat_id' : platform.startsWith('GOOGLE') ? 'gclid' : 'fbclid';
          await prisma.conversionEvent.create({
            data: {
              externalEventId: `seed-${dep.id}-${back}`,
              clickId: `${clickIdType === 'gclid' ? 'Cj0KCQ' : clickIdType === 'fbclid' ? 'IwAR' : ''}seed${dep.id}x${back}`,
              clickIdType,
              utmCampaign: buildUtmCampaign(campaign.id, campaign.name),
              campaignId: campaign.id,
              deploymentId: dep.id,
              platform,
              eventType: 'POLICY_PURCHASED',
              policyPremiumValue: new Prisma.Decimal((m.revenue / m.policiesSold).toFixed(2)),
              currency: 'NGN',
              dispatchedToPlatforms: true,
              dispatchResults: [{ destination: 'SEED', status: 'simulated', detail: 'seeded event' }],
              createdAt: new Date(date.getTime() + 13 * 3600_000),
            },
          });
          events++;
        }
      }
    }
  }
  console.log(`  ${DEMO.length} demo campaigns, ${metricRows} daily metric rows, ${events} conversion events`);
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
