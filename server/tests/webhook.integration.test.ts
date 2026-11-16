/**
 * End-to-end webhook test against a real MySQL database (DATABASE_URL).
 * Run with: DB_TESTS=1 npm test
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';

const run = process.env.DB_TESTS === '1';
const KEY = 'test-secret';

describe.runIf(run)('POST /api/webhooks/conversions (MySQL)', () => {
  const app = createApp();
  let productId: number;
  let campaignId: number;
  let igDeploymentId: number;
  let gsDeploymentId: number;
  const tag = `itest-${Date.now()}`;

  beforeAll(async () => {
    const product = await prisma.insuranceProduct.create({
      data: {
        insuranceClass: 'AUTO_MOTOR',
        name: `${tag} product`,
        targetAudienceSummary: 'test',
        keyBenefits: ['x'],
        startingPremium: new Prisma.Decimal('50000.00'),
        landingPageUrl: 'https://example.com',
        regulatoryLicenseNumber: 'NAICOM/TEST/1',
      },
    });
    productId = product.id;
    const campaign = await prisma.campaign.create({
      data: { productId, name: `${tag} campaign`, objective: 'POLICY_PURCHASE', totalDailyBudget: new Prisma.Decimal('1000.00'), targetLocations: { countries: ['NG'] } },
    });
    campaignId = campaign.id;
    await prisma.campaign.update({ where: { id: campaignId }, data: { utmCampaign: `ins-${campaignId}-${tag}` } });
    igDeploymentId = (await prisma.platformDeployment.create({ data: { campaignId, platform: 'INSTAGRAM', dailyBudget: new Prisma.Decimal('500.00') } })).id;
    gsDeploymentId = (await prisma.platformDeployment.create({ data: { campaignId, platform: 'GOOGLE_SEARCH', dailyBudget: new Prisma.Decimal('500.00') } })).id;
  });

  afterAll(async () => {
    await prisma.conversionEvent.deleteMany({ where: { campaignId } });
    await prisma.conversionEvent.deleteMany({ where: { externalEventId: { startsWith: tag } } });
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
    await prisma.insuranceProduct.deleteMany({ where: { id: productId } });
    await prisma.$disconnect();
  });

  it('rejects requests without a valid API key', async () => {
    await request(app).post('/api/webhooks/conversions').send({ eventType: 'QUOTE_STARTED' }).expect(401);
    await request(app).post('/api/webhooks/conversions').set('x-api-key', 'wrong').send({ eventType: 'QUOTE_STARTED' }).expect(401);
  });

  it('validates the payload', async () => {
    const res = await request(app).post('/api/webhooks/conversions').set('x-api-key', KEY).send({ eventType: 'POLICY_PURCHASED' }).expect(400);
    expect(JSON.stringify(res.body.details)).toContain('policyPremiumValue');
  });

  it('attributes a quote to the Instagram deployment and increments quotes_started', async () => {
    const res = await request(app)
      .post('/api/webhooks/conversions')
      .set('x-api-key', KEY)
      .send({ eventId: `${tag}-q1`, fbclid: 'IwAR-itest', utm_campaign: `ins-${campaignId}-${tag}`, utm_source: 'instagram', eventType: 'QUOTE_STARTED', email: 'Ada@Example.com' })
      .expect(201);
    expect(res.body.attribution).toMatchObject({ campaignId, deploymentId: igDeploymentId, platform: 'INSTAGRAM' });
    expect(res.body.dispatch.find((d: { destination: string }) => d.destination === 'META_CAPI').status).toBe('simulated');

    const ev = await prisma.conversionEvent.findUniqueOrThrow({ where: { externalEventId: `${tag}-q1` } });
    expect(ev.clickId).toBe('IwAR-itest');
    expect(ev.hashedEmail).toMatch(/^[0-9a-f]{64}$/);
    expect(ev.dispatchedToPlatforms).toBe(true);
    const m = await prisma.performanceMetric.findFirstOrThrow({ where: { deploymentId: igDeploymentId } });
    expect(m.quotesStarted).toBe(1);
  });

  it('stitches the purchase (same click id, no utm) and adds DECIMAL revenue exactly', async () => {
    const res = await request(app)
      .post('/api/webhooks/conversions')
      .set('x-api-key', KEY)
      .send({ eventId: `${tag}-p1`, clickId: 'IwAR-itest', eventType: 'POLICY_PURCHASED', policyPremiumValue: 87500.55 })
      .expect(201);
    expect(res.body.attribution.campaignId).toBe(campaignId);
    await request(app)
      .post('/api/webhooks/conversions')
      .set('x-api-key', KEY)
      .send({ eventId: `${tag}-p2`, gclid: 'Cj0K-itest', utm_campaign: `ins-${campaignId}-${tag}`, eventType: 'POLICY_PURCHASED', policyPremiumValue: '0.10' })
      .expect(201);
    await request(app)
      .post('/api/webhooks/conversions')
      .set('x-api-key', KEY)
      .send({ eventId: `${tag}-p3`, gclid: 'Cj0K-itest2', utm_campaign: `ins-${campaignId}-${tag}`, eventType: 'POLICY_PURCHASED', policyPremiumValue: '0.20' })
      .expect(201);
    const gs = await prisma.performanceMetric.findFirstOrThrow({ where: { deploymentId: gsDeploymentId } });
    expect(gs.policiesSold).toBe(2);
    expect(gs.revenueGenerated.toString()).toBe('0.3'); // DECIMAL, not 0.30000000000000004
  });

  it('is idempotent on eventId', async () => {
    const res = await request(app)
      .post('/api/webhooks/conversions')
      .set('x-api-key', KEY)
      .send({ eventId: `${tag}-p1`, clickId: 'IwAR-itest', eventType: 'POLICY_PURCHASED', policyPremiumValue: 87500.55 })
      .expect(200);
    expect(res.body.duplicate).toBe(true);
    const ig = await prisma.performanceMetric.findFirstOrThrow({ where: { deploymentId: igDeploymentId } });
    expect(ig.policiesSold).toBe(1);
    expect(ig.revenueGenerated.toString()).toBe('87500.55');
  });

  it('stores unattributed events without touching metrics', async () => {
    const res = await request(app).post('/api/webhooks/conversions').set('x-api-key', KEY).send({ eventId: `${tag}-u1`, clickId: 'nothing-matches', eventType: 'QUOTE_STARTED' }).expect(201);
    expect(res.body.attribution.campaignId).toBeNull();
  });
});
