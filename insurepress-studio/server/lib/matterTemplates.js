// One-click front & back matter generators. Each returns { section_type, matter_subtype, title, subtitle, doc }.
import { P, H, UL, OL, BLOCK } from '../../shared/render.js';
import { DEFAULT_DISCLAIMER, REGULATORY_FRAMEWORK, fmtMoney, buildCtaUrl } from '../../shared/constants.js';

const year = () => new Date().getFullYear();

export const GLOSSARY = [
  ['Average Clause', 'If you under-insure, the insurer pays only the same proportion of your loss as your sum insured bears to the true value.'],
  ['Claim Notification', 'Formally telling the insurer (through your broker) that a loss has happened. Most policies set a short deadline — often "immediately" or within a few days.'],
  ['Comprehensive Motor', 'Covers damage to your own vehicle, theft and fire, plus third-party liability.'],
  ['Deductible / Excess', 'The first part of every claim you pay yourself (e.g. 10% of the loss or a fixed Naira amount).'],
  ['Group Life Assurance', 'Life cover an employer buys for staff. Nigerian law requires employers to maintain it for employees (commonly at least three times annual total emolument under the Pension Reform Act 2014).'],
  ['Indemnity', 'The principle that insurance restores you to the financial position you were in before the loss — not better.'],
  ['Insurable Interest', 'You must stand to lose financially from the loss to be allowed to insure the item or person.'],
  ['Keyman Assurance', 'Life or disability cover a business buys on a person whose loss would hurt profits.'],
  ['NAICOM', 'The National Insurance Commission — the regulator of insurers, brokers and agents in Nigeria.'],
  ['NIIRA 2025', 'The Nigerian Insurance Industry Reform Act 2025, which consolidates and modernises Nigeria’s insurance laws.'],
  ['No Premium, No Cover', 'Cover only starts once the insurer has received your premium. An unpaid policy will not respond to a claim.'],
  ['Occupiers’ Liability', 'Cover for injury or damage suffered by visitors to premises you occupy or control.'],
  ['Proximate Cause', 'The dominant, effective cause of a loss. A claim is paid only if the proximate cause is an insured peril.'],
  ['Sum Insured', 'The maximum the insurer will pay — the value you declare.'],
  ['Subrogation', 'After paying you, the insurer may step into your shoes to recover the money from whoever caused the loss.'],
  ['Utmost Good Faith', 'You must disclose every material fact when buying insurance. Hiding facts can void the policy.'],
];

export function buildMatter(subtype, { book = {}, brand = {}, user = {}, ctas = [] } = {}) {
  const brokerage = user.brokerage_name || brand.name || 'Your Brokerage';
  const author = book.author_name || user.full_name || 'The Author';
  const license = user.naicom_license_no ? ` (NAICOM Licence No. ${user.naicom_license_no})` : '';
  const disclaimer = brand.default_disclaimer || DEFAULT_DISCLAIMER;
  const wa = ctas.find((c) => c.cta_type === 'whatsapp_quote');
  const audit = ctas.find((c) => c.cta_type === 'policy_audit') || wa;

  switch (subtype) {
    case 'title_page':
      return { section_type: 'front_matter', matter_subtype: 'title_page', title: 'Title Page', doc: { type: 'doc', content: [] } };

    case 'copyright':
      return {
        section_type: 'front_matter', matter_subtype: 'copyright', title: 'Copyright & Regulatory Disclaimer',
        doc: { type: 'doc', content: [
          P(`**${book.title || 'Untitled'}**${book.subtitle ? ` — ${book.subtitle}` : ''}`),
          P(`Copyright © ${year()} ${author}. All rights reserved.`),
          P(`Published by ${brand.name || brokerage}. No part of this publication may be reproduced, stored or transmitted in any form without the prior written permission of the publisher, except for brief quotations in reviews and the checklists marked “photocopiable”, which readers may copy for their own use.`),
          P(`**Regulatory framework:** ${brand.regulatory_framework || REGULATORY_FRAMEWORK}.`),
          P(`**Important disclaimer.** ${disclaimer}`),
          P(`Insurance brokerage services are provided by ${brokerage}${license}. Always read the policy wording, schedule and any endorsements before you buy.`),
          P(`ISBN: ____________________ · First edition ${year()} · Printed in Nigeria`),
        ] },
      };

    case 'dedication':
      return { section_type: 'front_matter', matter_subtype: 'dedication', title: 'Dedication',
        doc: { type: 'doc', content: [P('*To every business owner who has ever lain awake wondering, “What if?” — this book is for you.*')] } };

    case 'who_this_is_for':
      return {
        section_type: 'front_matter', matter_subtype: 'who_this_is_for', title: 'Who This Book Is For',
        doc: { type: 'doc', content: [
          P(`This book is written for **${book.target_persona || 'business owners and families'}** who want clear, honest answers about protecting their money, property and people — without the jargon.`),
          H(3, 'You will get the most from it if you…'),
          UL([
            'Have worked hard to build something and cannot afford to lose it to one bad night',
            'Have bought insurance before but are not sure what it actually covers',
            'Have heard stories of rejected claims and want to make sure it never happens to you',
            'Want a simple checklist you can act on this week',
          ]),
          H(3, 'This book is not…'),
          UL(['A sales brochure for any single insurer', 'Legal advice for your specific situation', 'A replacement for reading your own policy wording']),
          P(`Every chapter ends with an action checklist. Work through them with a pen — or with your broker on WhatsApp.`),
        ] },
      };

    case 'glossary':
      return {
        section_type: 'back_matter', matter_subtype: 'glossary', title: 'Plain-English Insurance Glossary',
        subtitle: 'Nigerian & global insurance jargon, translated',
        doc: { type: 'doc', content: GLOSSARY.map(([t, d]) => P(`**${t}** — ${d}`)) },
      };

    case 'claims_directory':
      return {
        section_type: 'back_matter', matter_subtype: 'claims_directory', title: 'Emergency Claims Readiness Directory',
        subtitle: 'Tear out, fill in and stick it where your team can see it',
        doc: { type: 'doc', content: [
          H(2, 'The first 24 hours after a loss'),
          OL([
            'Make people safe first. Call emergency services (Nigeria: **112**) and the Fire Service where relevant.',
            'Prevent further damage if it is safe to do so — insurers expect reasonable steps to minimise loss.',
            'Notify your broker immediately (phone and in writing). Note the date and time.',
            'Report theft, burglary or road accidents to the nearest police station and get an extract or report.',
            'Photograph and video everything before you clean up or repair.',
            'Do not admit liability or agree settlements with third parties without your insurer.',
          ]),
          H(2, 'Documents to keep in a “grab file” (and in the cloud)'),
          BLOCK('riskChecklist', { title: 'Claims Grab-File Checklist', intro: 'Keep copies on paper and on your phone.', items: [
            'Policy schedule and full policy wording for every cover',
            'Premium payment receipts / debit notes',
            'Stock records, invoices and asset register (with serial numbers)',
            'Vehicle papers, driver’s licences and proof of ownership',
            'Staff list with dates of birth and annual emoluments (Group Life)',
            'CAC documents and means of identification of directors',
          ] }),
          H(2, 'Key contacts'),
          { type: 'table', content: [
            ['Contact', 'Name', 'Phone / Email'],
            ['My insurance broker', brokerage, wa ? wa.destination_url.replace(/^https?:\/\//, '') : '__________'],
            ['Insurer(s) claims desk', '__________', '__________'],
            ['Nearest police station', '__________', '__________'],
            ['Fire service / emergency', 'National emergency', '112'],
            ['NAICOM consumer complaints', 'National Insurance Commission', 'naicom.gov.ng'],
          ].map((r, i) => ({ type: 'tableRow', content: r.map((cell) => ({ type: i === 0 ? 'tableHeader' : 'tableCell', content: [P(cell)] })) })) },
          P('If you are unhappy with how a claim has been handled, first complain in writing to the insurer. If it is not resolved, you can escalate to NAICOM’s complaints bureau or the Insurance Ombudsman where available.'),
        ] },
      };

    case 'about_author':
      return {
        section_type: 'back_matter', matter_subtype: 'about_author', title: 'About the Author & Brokerage',
        doc: { type: 'doc', content: [
          P(`**${author}** is a risk advisor and insurance broker with ${brokerage}${license}. Over the years ${author.split(' ')[0]} has helped business owners, employers and families across Nigeria and the diaspora design protection that actually pays when it matters.`),
          P(`${brokerage} is an independent, NAICOM-licensed insurance brokerage. As brokers we work for you, not for any one insurer: we compare options, place your cover, and stand beside you when you make a claim.`),
          ...(audit ? [BLOCK('ctaCard', {
            ctaId: audit.id, eyebrow: 'Readers’ offer', headline: 'Book your free Policy Gap Audit',
            body: 'Send your current policy schedules and we will show you, in plain English, what is covered, what is not, and what it would cost to fix.',
            buttonLabel: audit.label, url: buildCtaUrl(audit, { bookId: book.id }), qrDataUrl: audit.qr_data_url || '', promoCode: audit.promo_code || '', ctaType: audit.cta_type,
          })] : []),
        ] },
      };

    case 'next_steps': {
      const sell = ctas.find((c) => c.cta_type === 'selar_checkout' || c.cta_type === 'paystack_link');
      return {
        section_type: 'back_matter', matter_subtype: 'next_steps', title: 'Your Next Step',
        doc: { type: 'doc', content: [
          P('Reading is the first step. Acting is what protects you. Choose one action from this book and do it in the next seven days.'),
          ...(sell ? [BLOCK('ctaCard', { ctaId: sell.id, eyebrow: 'Share this book', headline: 'Gift a copy to a fellow business owner',
            body: `Order more copies for your team, your trade association or your clients. Corporate bulk licences are available.${book.price_amount ? ` Single copy: ${fmtMoney(book.price_amount, book.currency)}.` : ''}`,
            buttonLabel: sell.label, url: buildCtaUrl(sell, { bookId: book.id }), qrDataUrl: sell.qr_data_url || '', promoCode: sell.promo_code || '', ctaType: sell.cta_type })] : []),
        ] },
      };
    }
    default:
      return null;
  }
}

export const FRONT_MATTER_SET = ['title_page', 'copyright', 'dedication', 'who_this_is_for'];
export const BACK_MATTER_SET = ['glossary', 'claims_directory', 'about_author', 'next_steps'];
