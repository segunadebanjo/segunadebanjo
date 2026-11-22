// Manuscript content for the "Sleep Soundly" starter book.
// The author and brokerage are fictional; case studies are illustrative composites.
import { P, H, UL, OL, QUOTE, BLOCK } from '../../shared/render.js';

export const BOOK = {
  title: 'Sleep Soundly',
  subtitle: 'The Nigerian Business Owner’s Plain-English Guide to Protecting Your Company, Cash Flow, and Legacy from Unexpected Disasters',
  author_name: 'Funmilayo Adeyemi, ACIIN',
  target_persona: 'Nigerian SME owners: retailers, warehouse operators, pharmacies and light manufacturers with 5–50 staff',
  core_pain_point: 'One fire, burglary, staff death or rejected claim can wipe out years of hard work — and most SME owners don’t trust that insurance will actually pay.',
  monetization_goal: 'hybrid',
  price_amount: 7500,
  print_price: 15000,
  currency: 'NGN',
  trim_size: '6x9',
  theme_preset: 'executive-navy',
  target_word_count: 32000,
};

export const introduction = {
  section_type: 'body', matter_subtype: 'introduction', status: 'complete',
  title: 'Introduction: The Phone Call Every Owner Dreads', subtitle: 'Why this book exists, and how to use it',
  doc: { type: 'doc', content: [
    P('It was 2:40 a.m. when Chinedu’s phone rang. His warehouse manager was shouting over the noise of a crowd: the building next door was on fire, and the flames had jumped the fence. By the time the fire service arrived, twelve years of work — stock, forklifts, records, the small office where he had signed his first big supply contract — had turned to ash and twisted metal.'),
    P('Chinedu was insured. Or so he thought. His policy had been bought six years earlier, when his stock was worth a third of what it was on the night of the fire. The premium for the current year had been “arranged” with an agent but not yet paid. And nobody had told him that the policy he did have would only pay a fraction of a claim if the sum insured was too low.'),
    BLOCK('painPoint', { badge: 'Real Risk', severity: 'critical', title: 'Insurance that doesn’t pay is worse than no insurance', body: 'It gives you false confidence. You stop saving for emergencies, you take bigger risks, and when disaster comes, you discover the gap at the worst possible moment.' }),
    P('I have been an insurance broker for more than fifteen years. I have sat with owners like Chinedu on the worst day of their business lives. I have also sat with owners whose claims were paid in full, who reopened within weeks, and who still employ the same staff today. The difference between those two groups is almost never luck. It is a handful of decisions, made calmly, long before anything goes wrong.'),
    H(2, 'What this book will do for you'),
    UL([
      'Show you the **six disasters** most likely to hurt a Nigerian SME — and what each one really costs.',
      'Explain, in plain English, the covers that respond: Fire & Special Perils, Burglary, Business Interruption, Group Life, Public Liability and more.',
      'Expose the **silent claim killers** — under-insurance, late notification, non-disclosure and unpaid premium — so they never catch you out.',
      'Walk you through what the **Nigerian Insurance Industry Reform Act 2025 (NIIRA 2025)** and NAICOM rules mean for your business.',
      'Give you checklists you can complete in under an hour, with or without a broker.',
    ]),
    BLOCK('mythFact', { myth: 'Insurance companies in Nigeria never pay claims.', fact: 'Insurers settle valid claims every working day. When claims fail, the cause is usually something the policyholder could have fixed in advance: the wrong cover, the wrong sum insured, late notice or unpaid premium.' }),
    P('Read it in order, or jump straight to the chapter that keeps you up at night. Every chapter ends with an action checklist. Do the checklist, and you will sleep a little more soundly that night.'),
  ] },
};

export const chapter1 = {
  section_type: 'body', matter_subtype: 'chapter', status: 'complete',
  title: 'One Bad Night: Fire, Burglary and the Stock You Can’t Replace',
  subtitle: 'Protecting the physical heart of your business',
  doc: { type: 'doc', content: [
    P('Walk through any major market in Lagos, Onitsha, Aba or Kano and you will see the same thing: extraordinary value packed into small spaces. Containers of imported goods. Shelves of pharmaceuticals bought at today’s exchange rate. Generators running beside fuel stored in jerrycans. Electrical extensions daisy-chained across a ceiling. It is the engine of the Nigerian economy — and it is one spark away from disaster.'),
    BLOCK('painPoint', { badge: 'Real Risk', severity: 'high', title: 'Your stock is probably worth far more than you think', body: 'Naira devaluation means the stock you bought for ₦15 million two years ago could cost ₦35 million to replace today. If your policy still says ₦15 million, you are under-insured — and every claim will be cut.' }),
    H(2, 'The two disasters that close SMEs fastest'),
    P('In my experience, two events end more small businesses than any others: **fire** and **burglary**. Fire because it is total — it takes the stock, the equipment, the records and often the building in one night. Burglary because it is frequent, and because the losses are rarely reported to police in time to support a claim.'),
    H(3, 'Fire & Special Perils'),
    P('A Fire & Special Perils policy pays for physical loss or damage to your buildings, stock, furniture and equipment caused by fire, lightning, explosion and a list of “special perils” you can add: storm, flood, riot and strike, malicious damage, bursting pipes and impact. It does not pay for wear and tear, gradual deterioration or losses you cause deliberately.'),
    BLOCK('jargon', { term: 'Special Perils', technical: 'The insurance under this policy may be extended to include loss or damage caused by riot, strike, malicious damage, storm, tempest, flood, bursting or overflowing of water tanks, apparatus or pipes, and impact by vehicles or animals, subject to the payment of an additional premium.', plain: 'Extra risks beyond fire that you can switch on for a small extra cost — especially flood and riot, which matter a lot in Nigeria.', example: 'A Lekki boutique adds flood cover for an extra ₦45,000 a year after the 2024 rainy-season floods.' }),
    H(3, 'Burglary (Theft) insurance'),
    P('Burglary insurance pays for stock, cash and equipment stolen from your premises — but almost always only where there is **evidence of forcible and violent entry or exit**. A shop attendant walking away with a carton is usually not burglary; that is what Fidelity Guarantee insurance is for.'),
    BLOCK('comparison', { title: 'Which cover pays for which loss?', columns: ['What happened', 'Fire & Special Perils', 'Burglary', 'Fidelity Guarantee'], rows: [
      ['Electrical fire destroys stock', '✔ Covered', '✖', '✖'],
      ['Thieves break the roof and steal goods', '✖', '✔ Covered', '✖'],
      ['Trusted staff steals cash over months', '✖', '✖ (no forced entry)', '✔ Covered'],
      ['Flood damages ground-floor stock', 'Only with flood extension', '✖', '✖'],
      ['Rioters loot and burn the shop', 'With riot & strike extension', 'Depends on wording', '✖'],
    ] }),
    H(2, 'What a paid claim actually looks like'),
    BLOCK('claimCase', { title: 'The Onitsha Electronics Fire', incident: 'A neighbouring shop’s generator caught fire at 1 a.m. and spread to Mrs Okonkwo’s electronics store. Stock and fittings were destroyed.', uninsuredOutcome: 'Her neighbour, uninsured, lost all stock and borrowed at 28% to restart. He reopened 7 months later with half his customers gone.', uninsuredAmount: 38500000, insuredOutcome: 'Mrs Okonkwo’s Fire & Special Perils policy (updated at renewal) paid stock and fittings less a 10% excess within 41 days of complete documents.', insuredAmount: 34650000, lesson: 'Update your sum insured at every renewal and keep stock records off-site. Her claim moved fast because she could prove what she had.', currency: 'NGN' }),
    P('*Names and figures are illustrative; details have been changed to protect privacy.*'),
    H(2, 'Five fire and burglary habits that get claims paid'),
    OL([
      '**Insure at today’s replacement value.** Review the sum insured at every renewal, and mid-year if you restock heavily.',
      '**Keep records away from the shop.** Photograph invoices and stock sheets weekly and store them in the cloud or on WhatsApp.',
      '**Fix the obvious hazards.** Insurers can reduce claims where warranties (fire extinguishers, no fuel storage near generators) were ignored.',
      '**Report burglaries to the police immediately** and get a police report or extract — insurers will ask for it.',
      '**Notify your broker within hours, not weeks.** Most policies require immediate notice of any loss.',
    ]),
    BLOCK('ctaCard', { eyebrow: 'Free for readers', headline: 'Not sure if your stock is under-insured?', body: 'Send a photo of your current Fire policy schedule on WhatsApp. A licensed broker will check your sum insured against today’s replacement values — free, within 24 hours.', buttonLabel: 'Start a WhatsApp audit', promoCode: 'SLEEPSOUNDLY' }),
    BLOCK('riskChecklist', { title: 'Chapter 1 Action Checklist', intro: 'Tick each item you can honestly say “Yes” to.', items: [
      'I know the current replacement value of my stock, not the purchase price',
      'My Fire policy includes the special perils that matter to me (flood, riot, malicious damage)',
      'I have burglary cover, and I know what counts as “forcible entry”',
      'My stock records and invoices are backed up off-site',
      'Fire extinguishers are serviced and fuel is stored away from generators',
      'My broker’s claims number is saved in my phone',
    ] }),
  ] },
};

export const chapter2 = {
  section_type: 'body', matter_subtype: 'chapter', status: 'polishing',
  title: 'The Silent Claim Killers', subtitle: 'Under-insurance, late notification and “No Premium, No Cover”',
  doc: { type: 'doc', content: [
    P('Most claim disputes I have handled were not lost on the night of the disaster. They were lost months earlier — at renewal, in a hurried phone call with an agent, or in a policy schedule that nobody read. I call these the silent claim killers. They make no noise until the day you need your insurance, and then they make all the noise in the world.'),
    H(2, 'Killer #1: Under-insurance and the Average Clause'),
    P('Almost every property policy in Nigeria contains an Average Clause. It is the single most misunderstood sentence in insurance, and it quietly reduces thousands of claims every year.'),
    BLOCK('jargon', { term: 'Average Clause', technical: 'If the property hereby insured shall at the time of any loss or damage be collectively of greater value than the sum insured thereon, then the insured shall be considered as being their own insurer for the difference and shall bear a rateable proportion of the loss or damage accordingly.', plain: 'If you insure your goods for less than they are really worth, the insurer treats you as carrying part of the risk yourself — and cuts every claim by the same percentage.', example: 'Stock worth ₦40m insured for ₦20m (50%). A ₦10m fire loss pays only ₦5m, minus the excess.' }),
    BLOCK('claimCase', { title: 'The Pharmacy That Saved ₦180,000 a Year', incident: 'A Kano pharmacy kept its sum insured at ₦25m for four years to keep premium low. Real stock value had grown to ₦50m when a burst pipe and electrical fault damaged ₦12m of stock.', uninsuredOutcome: 'With the Average Clause applied, the claim paid only half of the loss — the owner absorbed the rest.', uninsuredAmount: 6000000, insuredOutcome: 'A correctly valued policy would have paid the full ₦12m loss, less a ₦600,000 excess.', insuredAmount: 11400000, lesson: 'The “saving” on premium cost the owner ₦5.4 million on a single claim. Under-insurance is the most expensive way to save money.', currency: 'NGN' }),
    P('*Names and figures are illustrative.*'),
    H(2, 'Killer #2: No Premium, No Cover'),
    P('Nigerian insurance law has, for many years, applied a simple rule: **no insurance cover is granted unless the premium has been received by the insurer.** The Nigerian Insurance Industry Reform Act 2025 continues this principle, and NAICOM enforces it strictly. If you have promised to pay “next week”, given cash to someone who never remitted it, or let a renewal lapse, there is no policy to claim on — no matter what anyone told you on the phone.'),
    BLOCK('mythFact', { myth: 'My agent said I’m covered while I arrange payment.', fact: 'Cover begins only when the insurer receives the premium. Ask for a receipt or debit note acknowledgement, and pay through traceable channels (bank transfer to the insurer or your licensed broker’s client account).' }),
    BLOCK('painPoint', { badge: 'Watch out', severity: 'critical', title: 'Paying cash to an unlicensed “agent”', body: 'Every year, business owners lose money to people who collect premium and never remit it. Always confirm that your insurer, broker or agent is licensed by NAICOM, and keep proof of payment.' }),
    H(2, 'Killer #3: Late notification'),
    P('Most policies say you must notify the insurer “immediately” or within a short number of days after a loss. Owners often wait — to clean up, to count stock, to find receipts. But late notice can prejudice the insurer’s investigation, and an insurer may reduce or decline a claim because of it. Call your broker first; tidy up later.'),
    H(2, 'Killer #4: Non-disclosure'),
    P('Insurance is a contract of **utmost good faith**. When you buy a policy, you must disclose every fact that would affect the insurer’s decision: previous losses, the true nature of your business, hazardous goods, security arrangements. Hiding a fact to get a lower premium can void the whole policy.'),
    BLOCK('comparison', { title: 'The four claim killers at a glance', columns: ['Claim killer', 'What it does to your claim', 'The 5-minute fix'], rows: [
      ['Under-insurance', 'Average Clause cuts every claim proportionally', 'Re-value stock and assets at every renewal'],
      ['Unpaid premium', 'No cover at all — claim declined', 'Pay before inception; keep the receipt'],
      ['Late notification', 'Claim reduced or declined', 'Save your broker’s claims line; notify first'],
      ['Non-disclosure', 'Policy may be voided', 'Tell your broker everything material, in writing'],
    ] }),
    BLOCK('riskChecklist', { title: 'Chapter 2 Action Checklist', intro: 'Do these before your next renewal.', items: [
      'I have checked my sum insured against today’s replacement value',
      'Every current premium is paid and I have the receipt or debit note',
      'I know my policy’s claim notification deadline',
      'My broker has a written record of everything material about my business',
      'I have verified my insurer/broker on the NAICOM website',
    ] }),
  ] },
};

export const chapter3 = {
  section_type: 'body', matter_subtype: 'chapter', status: 'drafting',
  title: 'Your People Are Your Business', subtitle: 'Group Life, Keyman Assurance and your duties as an employer',
  doc: { type: 'doc', content: [
    P('A warehouse can be rebuilt. Stock can be restocked. But when a trusted supervisor dies in a road accident on the way to work, a business owner faces something no fire policy can fix: a grieving family at the gate, a team in shock, and — too often — a legal duty they did not know they had.'),
    BLOCK('painPoint', { badge: 'Real Risk', severity: 'high', title: '“Group Life is only for big companies”', body: 'Nigerian law expects employers to maintain Group Life insurance for their employees. Many SMEs only discover this when a staff member dies — and the family, or their lawyer, asks where the benefit is.' }),
    H(2, 'Group Life Assurance: a legal duty, not a perk'),
    P('Under the Pension Reform Act 2014, employers are required to maintain a Group Life insurance policy in favour of each employee, with a benefit commonly set at a minimum of three times the employee’s annual total emolument. The Nigerian Insurance Industry Reform Act 2025 reinforces the framework for compulsory insurances and NAICOM’s supervision of them. Check the current requirements with your broker or legal adviser — thresholds and enforcement can change.'),
    BLOCK('jargon', { term: 'Annual Total Emolument', technical: 'The aggregate of basic salary, housing allowance and transport allowance payable to the employee in a year, as declared in the schedule of employees submitted to the insurer.', plain: 'The yearly total of a staff member’s basic pay plus housing and transport allowances — the number the Group Life benefit is calculated from.', example: 'A supervisor on ₦400,000 a month (basic + housing + transport) has an annual total emolument of ₦4.8m, so a 3× benefit is ₦14.4m.' }),
    BLOCK('claimCase', { title: 'The Factory Supervisor', incident: 'Mr Bello, a 41-year-old supervisor at an Ikeja plastics factory earning ₦4.8m a year, died in a road accident.', uninsuredOutcome: 'A neighbouring factory with no Group Life faced a demand for benefits it had to fund from working capital, plus months of legal correspondence.', uninsuredAmount: 14400000, insuredOutcome: 'The employer’s Group Life policy paid three times annual emolument to the named beneficiaries within weeks of complete documents.', insuredAmount: 14400000, lesson: 'Send your insurer an updated staff schedule whenever salaries change or you hire. The benefit follows the emoluments you declared.', currency: 'NGN' }),
    P('*Names and figures are illustrative.*'),
    H(2, 'Group Life vs. Keyman Assurance'),
    BLOCK('comparison', { title: 'Statutory Group Life vs. Keyman Assurance', columns: ['', 'Group Life Assurance', 'Keyman Assurance'], rows: [
      ['Who is insured', 'All employees', 'One or more key people (MD, top salesperson, engineer)'],
      ['Who receives the money', 'The employee’s named beneficiaries', 'The business'],
      ['Is it compulsory?', 'Yes, for employers (verify current scope)', 'No — a business decision'],
      ['What the money is for', 'Supporting the employee’s family', 'Replacing lost profit, recruiting, reassuring lenders'],
      ['Typical premium basis', 'Percentage of total annual payroll', 'Age, health and sum assured of the key person'],
    ] }),
    BLOCK('mythFact', { myth: 'Our staff have pensions, so Group Life isn’t needed.', fact: 'Pensions and Group Life do different jobs. A pension builds savings over time; Group Life pays a lump sum to the family if an employee dies in service.' }),
    BLOCK('riskChecklist', { title: 'Chapter 3 Action Checklist', items: [
      'Every employee is listed on our Group Life schedule',
      'The schedule reflects current salaries and allowances',
      'Each employee has completed a beneficiary nomination form',
      'We have considered Keyman cover for the people the business cannot run without',
      'We have a copy of our current Group Life certificate for tenders and audits',
    ] }),
    BLOCK('ctaCard', { eyebrow: 'For HR & business owners', headline: 'Get a Group Life quote in 10 minutes', body: 'Send your staff count and total annual payroll on WhatsApp and we will compare quotes from leading NAICOM-licensed insurers for you.', buttonLabel: 'Request a quote', promoCode: 'SLEEPSOUNDLY' }),
  ] },
};

export const workbook = {
  section_type: 'workbook', matter_subtype: 'worksheet', status: 'complete',
  title: 'Your 30-Minute Business Risk Audit', subtitle: 'Photocopiable worksheet',
  doc: { type: 'doc', content: [
    P('Complete this worksheet with your latest policy schedules in front of you. Any “No” is a conversation to have with your broker this month.'),
    BLOCK('riskChecklist', { title: 'Section A — Property & Stock', intro: 'Fire, burglary and special perils', items: [
      'Sum insured for stock reflects today’s replacement value',
      'Buildings are insured at rebuild cost (not purchase price)',
      'Flood and riot extensions are included where relevant',
      'Burglary cover includes cash in safe and in transit',
    ] }),
    BLOCK('riskChecklist', { title: 'Section B — Income & Liability', intro: 'Keeping the business alive after a loss', items: [
      'Business Interruption cover is in place with an adequate indemnity period',
      'Public Liability covers injury to customers and visitors',
      'Goods-in-Transit cover is in place for deliveries',
    ] }),
    BLOCK('riskChecklist', { title: 'Section C — People & Compliance', intro: 'Statutory and people covers', items: [
      'Group Life schedule is complete and current',
      'Motor Third-Party (at minimum) is in force for every vehicle',
      'All premiums are paid and receipted (No Premium, No Cover)',
      'Insurer and broker licences verified with NAICOM',
    ] }),
  ] },
};

export const CTAS = [
  { label: 'Buy the eBook on Selar', cta_type: 'selar_checkout', destination_url: 'https://selar.co/sleep-soundly-ebook', promo_code: 'LAUNCH20' },
  { label: 'Order the paperback (Paystack)', cta_type: 'paystack_link', destination_url: 'https://paystack.com/pay/sleep-soundly-print', promo_code: null },
  { label: 'WhatsApp Instant Policy Audit', cta_type: 'whatsapp_quote', destination_url: 'https://wa.me/2348031234567', whatsapp_prefill_text: 'Hello! I’m reading “Sleep Soundly” and I’d like a free Policy Gap Audit for my business. Code: SLEEPSOUNDLY', promo_code: 'SLEEPSOUNDLY' },
];
