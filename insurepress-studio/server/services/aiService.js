// AI service layer: Blueprint Wizard, Co-Pilot actions, compliance review and launch copy.
// Uses Claude via @anthropic-ai/sdk when ANTHROPIC_API_KEY is set; otherwise a deterministic
// mock mode returns realistic sample output so every feature can be tested offline.
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { libraryFor } from '../lib/audienceLibrary.js';
import { GLOSSARY } from '../lib/matterTemplates.js';
import { ruleBasedCompliance, RECOMMENDED_DISCLAIMER } from './compliance.js';
import { docToText } from '../../shared/render.js';
import { fmtMoney, AUDIENCES } from '../../shared/constants.js';

const client = config.ai.apiKey ? new Anthropic({ apiKey: config.ai.apiKey }) : null;

export const aiStatus = () => ({ mode: client ? 'live' : 'mock', model: client ? config.ai.model : 'mock' });

// ---- Prompting helpers ---------------------------------------------------------------------

const SYSTEM = `You are the InsurePress Co-Pilot: a senior Nigerian insurance broker, risk educator and non-fiction book editor.
You help NAICOM-licensed brokers write books that are accurate, warm, plain-English and commercially useful.
Ground rules:
- Regulatory frame: the Nigerian Insurance Industry Reform Act 2025 (NIIRA 2025), NAICOM rules and market-conduct guidelines, the Pension Reform Act 2014 (Group Life), and related compulsory insurances (Motor Third-Party, Builders' Liability, Occupiers' Liability for public buildings, Group Life, etc.). When you are not certain of a section number, threshold or date, describe the rule in general terms and tell the author to verify it — never invent citations.
- Never promise guaranteed payouts, "always pays", "risk-free" or the "best/cheapest insurer". Always respect "No Premium, No Cover".
- Case studies are anonymised composites with realistic Naira (₦) figures, labelled as illustrative.
- Write for the reader's fears and goals first, insurance jargon second. Short sentences. Nigerian context (Lagos, Kano, Onitsha, Aba, Port Harcourt, generators, markets, Danfo, NEPA/PHCN, Average Clause) where natural.
- Output ONLY the JSON requested, no markdown fences, no commentary.`;

const BLOCK_SPEC = `Content is an array "blocks". Allowed block objects:
{"type":"heading","level":2|3,"text":"..."}
{"type":"paragraph","text":"... (may use **bold** and *italic*)"}
{"type":"bullets","items":["..."]} | {"type":"numbered","items":["..."]} | {"type":"quote","text":"..."}
{"type":"painPoint","data":{"badge":"Real Risk","title":"...","body":"...","severity":"medium|high|critical"}}
{"type":"claimCase","data":{"title":"...","incident":"...","uninsuredOutcome":"...","uninsuredAmount":12000000,"insuredOutcome":"...","insuredAmount":10800000,"lesson":"...","currency":"NGN"}}
{"type":"jargon","data":{"term":"...","technical":"policy wording","plain":"plain English","example":"..."}}
{"type":"comparison","data":{"title":"...","columns":["Feature","Option A","Option B"],"rows":[["...","...","..."]]}}
{"type":"mythFact","data":{"myth":"...","fact":"..."}}
{"type":"riskChecklist","data":{"title":"...","intro":"...","items":["..."]}}`;

function extractJson(text) {
  const t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const start = t.search(/[[{]/);
  const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
  throw new Error('AI response was not valid JSON');
}

async function callClaude(userPrompt, { maxTokens = 16000 } = {}) {
  const base = {
    model: config.ai.model,
    max_tokens: maxTokens,
    output_config: { effort: config.ai.effort },
    system: SYSTEM,
    messages: [{ role: 'user', content: userPrompt }],
  };
  let msg;
  try {
    // Server-side refusal fallback keeps the co-pilot answering if the primary model declines.
    msg = await client.beta.messages.stream({ ...base, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }).finalMessage();
  } catch (err) {
    if (err instanceof Anthropic.BadRequestError) msg = await client.messages.stream(base).finalMessage();
    else throw err;
  }
  if (msg.stop_reason === 'refusal') throw new Error('The AI declined this request. Try rephrasing your notes.');
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return extractJson(text);
}

const bookContext = (book = {}) =>
  `Book: "${book.title || ''}"${book.subtitle ? ` — ${book.subtitle}` : ''}\nAudience: ${book.target_persona || 'n/a'}\nCore pain point: ${book.core_pain_point || 'n/a'}\nCurrency: ${book.currency || 'NGN'}`;

// ---- Blueprint wizard ----------------------------------------------------------------------

export async function generatePainPoints({ audienceId, customAudience, notes = '' }) {
  const lib = libraryFor(audienceId, customAudience);
  if (!client) {
    return { audience: lib.label, persona: lib.persona, painPoints: lib.painPoints, recommendedPolicies: policiesFrom(lib.painPoints), mode: 'mock' };
  }
  const out = await callClaude(`Audience segment: ${customAudience || lib.label}
Persona hint: ${lib.persona}
Author notes: ${notes || 'none'}
Reference pain points (improve, localise and extend; keep 6-8): ${JSON.stringify(lib.painPoints)}

Return JSON {"persona":"...","painPoints":[{"title","fear","trigger","misconception","financialConsequence","policies":["..."]}],
"recommendedPolicies":[{"name","statutory":true|false,"solves":"...","note":"verification note if statutory"}]}.
Cover visceral financial fears, claim-rejection myths (e.g. No Premium No Cover, Average Clause/under-insurance, late notification, non-disclosure) and real loss triggers, mapped to policies and statutory covers under NIIRA 2025.`);
  return { audience: customAudience || lib.label, ...out, mode: 'live' };
}

function policiesFrom(painPoints) {
  const map = new Map();
  for (const p of painPoints) for (const pol of p.policies || []) {
    const name = pol.replace(/\s*\((statutory|compulsory)[^)]*\)/i, '').trim();
    if (!map.has(name)) map.set(name, { name, statutory: /statutory|compulsory/i.test(pol), solves: p.title, note: /statutory|compulsory/i.test(pol) ? 'Compulsory cover — confirm current scope and limits under NIIRA 2025 / NAICOM guidance.' : '' });
  }
  return [...map.values()];
}

export async function generateOutline({ audience, painPoints = [], persona = '', authorName = '', notes = '' }) {
  if (!client) return mockOutline({ audience, painPoints, persona });
  const out = await callClaude(`Audience: ${audience}
Persona: ${persona}
Author: ${authorName}
Notes: ${notes}
Selected pain points: ${JSON.stringify(painPoints)}

Create 5 market-tested book titles and a complete outline. Titles should sell protection, peace of mind and money saved — not jargon.
Return JSON {"titles":[{"title","subtitle","hook"}],"corePainPoint":"one sentence","outline":[{"section_type":"front_matter|body|workbook|back_matter","matter_subtype":"title_page|copyright|who_this_is_for|introduction|chapter|case_study|worksheet|checklist|glossary|claims_directory|about_author|next_steps","title","subtitle","summary","suggestedBlocks":["painPoint","claimCase","jargon","comparison","mythFact","riskChecklist","ctaCard"],"painPointIndex":0}]}
The outline needs front matter (title_page, copyright, who_this_is_for, introduction), 8-12 body items (pain-point chapters plus at least one case_study chapter), 2 workbook items, and back matter (glossary, claims_directory, about_author, next_steps).`);
  return { ...out, mode: 'live' };
}

function mockOutline({ audience, painPoints, persona }) {
  const aud = audience || 'Nigerian Business Owners';
  const short = aud.split(/[(&,]/)[0].trim();
  const pts = painPoints.length ? painPoints : libraryFor('sme').painPoints;
  const titles = [
    { title: 'Sleep Soundly', subtitle: `The ${short} Plain-English Guide to Protecting Your Cash Flow, Assets and Legacy`, hook: 'Peace of mind as the promise.' },
    { title: 'The Claim That Got Paid', subtitle: `How ${short} Avoid the 7 Mistakes That Get Insurance Claims Rejected`, hook: 'Flips the “insurers never pay” fear.' },
    { title: 'One Bad Night', subtitle: `What Every ${short.replace(/s$/, '')} Must Do Before Fire, Theft or Disaster Strikes`, hook: 'Urgency and loss aversion.' },
    { title: 'Protected', subtitle: `A Broker’s Field Guide for ${short} Who Refuse to Lose Everything`, hook: 'Authority + identity.' },
    { title: 'Don’t Insure It Twice, Don’t Insure It Half', subtitle: `Cutting Premium Waste and Closing Cover Gaps for ${short}`, hook: 'Money-saving angle for price-sensitive buyers.' },
  ];
  const outline = [
    { section_type: 'front_matter', matter_subtype: 'title_page', title: 'Title Page' },
    { section_type: 'front_matter', matter_subtype: 'copyright', title: 'Copyright & Regulatory Disclaimer' },
    { section_type: 'front_matter', matter_subtype: 'who_this_is_for', title: 'Who This Book Is For' },
    { section_type: 'body', matter_subtype: 'introduction', title: 'Introduction: The Night Everything Can Change', summary: `Why ${short} lose sleep over risk, and how this book turns fear into a simple protection plan.`, suggestedBlocks: ['painPoint', 'mythFact'] },
    ...pts.slice(0, 8).map((p, i) => ({
      section_type: 'body', matter_subtype: 'chapter', title: p.title.replace(/^./, (c) => c.toUpperCase()),
      subtitle: `Protecting yourself from ${p.trigger.split(',')[0].toLowerCase()}`,
      summary: `${p.fear}. Debunks “${p.misconception.replace(/[“”"]/g, '')}” and shows how ${p.policies.join(' and ')} respond.`,
      suggestedBlocks: ['painPoint', i % 2 ? 'comparison' : 'claimCase', 'jargon', 'mythFact', 'riskChecklist'], painPointIndex: i,
    })),
    { section_type: 'body', matter_subtype: 'case_study', title: 'Three Claims, Three Outcomes', summary: 'Anonymised Naira case studies comparing insured and uninsured outcomes.', suggestedBlocks: ['claimCase', 'claimCase', 'claimCase'] },
    { section_type: 'body', matter_subtype: 'chapter', title: 'Working With a Broker Who Fights for You', summary: 'How brokers place cover, check wording and push claims — and the free audit offer.', suggestedBlocks: ['comparison', 'ctaCard'] },
    { section_type: 'workbook', matter_subtype: 'worksheet', title: 'Your 30-Minute Risk Audit Worksheet', summary: 'A printable self-assessment.', suggestedBlocks: ['riskChecklist'] },
    { section_type: 'workbook', matter_subtype: 'checklist', title: 'Policy Renewal & Claims Checklist', summary: 'What to check every renewal and after every loss.', suggestedBlocks: ['riskChecklist', 'ctaCard'] },
    { section_type: 'back_matter', matter_subtype: 'glossary', title: 'Plain-English Insurance Glossary' },
    { section_type: 'back_matter', matter_subtype: 'claims_directory', title: 'Emergency Claims Readiness Directory' },
    { section_type: 'back_matter', matter_subtype: 'about_author', title: 'About the Author & Brokerage' },
    { section_type: 'back_matter', matter_subtype: 'next_steps', title: 'Your Next Step' },
  ];
  return { titles, corePainPoint: `${persona || short} fear that one fire, theft or rejected claim could wipe out years of work — and don’t trust that insurance will actually pay.`, outline, mode: 'mock' };
}

// ---- Co-Pilot actions ----------------------------------------------------------------------

export const COPILOT_ACTIONS = {
  draft_chapter: 'Draft Chapter from Outline Notes',
  pain_hook: 'Inject Relatable Pain-Point Hook',
  claim_scenario: 'Generate Anonymized Claim Scenario',
  simplify_jargon: 'Simplify Insurance Jargon',
  summary_checklist: 'Create Chapter Summary & Action Checklist',
  compliance_check: 'NAICOM & NIIRA 2025 Compliance Check',
};

export async function runCopilot(action, { book = {}, chapter = {}, doc = null, selection = '', notes = '' }) {
  if (!COPILOT_ACTIONS[action]) throw new Error(`Unknown action: ${action}`);
  const chapterText = doc ? docToText(doc).slice(0, 24000) : '';
  if (action === 'compliance_check') return complianceCheck({ book, chapter, doc, chapterText });

  if (!client) return { ...mockCopilot(action, { book, chapter, chapterText, selection, notes }), mode: 'mock' };

  const tasks = {
    draft_chapter: `Write the full chapter (1,400–2,000 words) from the outline notes below. Open with a scene the reader recognises, explain the risk and the cover that solves it, include 3–5 visual blocks (at least one painPoint, one claimCase or comparison, one jargon or mythFact) and finish with a "Your action steps" riskChecklist. Do not repeat the chapter title as a heading.`,
    pain_hook: `Write a 2–3 block opening hook for this chapter: one painPoint block and one short vivid paragraph that makes the reader feel the risk personally.`,
    claim_scenario: `Create ONE anonymised claim scenario as a claimCase block (realistic ${book.currency || 'NGN'} figures relevant to this chapter), followed by a one-paragraph debrief. Mention that names and figures are illustrative.`,
    simplify_jargon: `Find the 2–4 most technical insurance terms or clauses in the text and return a jargon block for each, then one paragraph rewriting the hardest passage in plain English.`,
    summary_checklist: `Return a "Chapter in a nutshell" heading, 4–6 summary bullets and a riskChecklist of 5–8 concrete actions the reader can take this week.`,
  };
  const out = await callClaude(`${bookContext(book)}
Chapter: "${chapter.title || ''}"${chapter.subtitle ? ` — ${chapter.subtitle}` : ''}
Author notes / outline: ${notes || '(see chapter text)'}
${selection ? `Selected text: """${selection.slice(0, 6000)}"""` : ''}
Current chapter text: """${chapterText || '(empty)'}"""

Task: ${tasks[action]}
${BLOCK_SPEC}
Return JSON {"message":"one-line note for the author","blocks":[...]}`);
  return { message: out.message || COPILOT_ACTIONS[action], blocks: out.blocks || [], mode: 'live' };
}

async function complianceCheck({ book, chapter, doc, chapterText }) {
  const rules = ruleBasedCompliance(doc || chapterText);
  let ai = null;
  if (client && chapterText.trim()) {
    try {
      ai = await callClaude(`${bookContext(book)}
Audit this chapter ("${chapter.title || ''}") against NAICOM market-conduct expectations and the Nigerian Insurance Industry Reform Act 2025. Flag misleading or guaranteed-payout phrasing, incorrect statements about statutory/compulsory covers ("No Premium, No Cover", Group Life, Motor Third-Party, Builders'/Occupiers' liability), inaccurate claims-documentation guidance, and missing disclaimers. Do not invent section numbers.
Text: """${chapterText}"""
Return JSON {"verdict":"one sentence","flags":[{"severity":"high|medium|low","excerpt":"exact short quote","issue":"...","rule":"...","suggestion":"compliant rewrite"}],"checks":["things done well"],"recommendedDisclaimer":"..."}`);
    } catch (e) {
      ai = { verdict: `AI review unavailable (${e.message}); rule-based checks shown.`, flags: [], checks: [] };
    }
  }
  const flags = [...rules.flags, ...((ai?.flags || []).map((f) => ({ ...f, source: 'ai' })))];
  const weights = { high: 18, medium: 9, low: 4 };
  const score = Math.max(0, 100 - flags.reduce((s, f) => s + (weights[f.severity] || 4), 0));
  const verdict = ai?.verdict || (score >= 85 ? 'Low compliance risk. Review the notes below before publishing.' : score >= 60 ? 'Moderate risk: fix the flagged phrases before publishing.' : 'High risk: this chapter contains misleading or non-compliant claims.');
  return {
    kind: 'compliance', mode: client ? 'live' : 'mock',
    report: { score, verdict, flags, checks: [...new Set([...(rules.checks || []), ...(ai?.checks || [])])], recommendedDisclaimer: ai?.recommendedDisclaimer || RECOMMENDED_DISCLAIMER, framework: 'NAICOM & Nigerian Insurance Industry Reform Act 2025' },
  };
}

function topicOf(chapter, chapterText) {
  const s = `${chapter.title || ''} ${chapter.subtitle || ''} ${chapterText.slice(0, 600)}`.toLowerCase();
  if (/motor|fleet|vehicle|truck|car/.test(s)) return 'motor';
  if (/group life|staff|employee|hr\b|keyman/.test(s)) return 'life';
  if (/burglar|theft|steal/.test(s)) return 'burglary';
  if (/interruption|shutdown|cash ?flow|closed/.test(s)) return 'bi';
  if (/build|landlord|occupier|property|home/.test(s)) return 'property';
  return 'fire';
}

const CASES = {
  fire: { title: 'The Onitsha Market Fire', incident: 'A neighbouring shop’s generator caught fire at night and spread to Mrs A’s electronics store.', uninsuredOutcome: 'Lost all stock, took a 28% loan to restart and closed for four months.', uninsuredAmount: 35000000, insuredOutcome: 'Fire & Special Perils paid stock value less 10% excess; Business Interruption paid rent and salaries for 3 months.', insuredAmount: 39500000, lesson: 'Insure stock at current replacement value and add Business Interruption — the fire is only half the loss.' },
  burglary: { title: 'The Long-Weekend Break-In', incident: 'Thieves cut through the roof of a Kano pharmacy over a public holiday and emptied the controlled-drugs store.', uninsuredOutcome: 'Owner absorbed the loss and could not restock for six weeks.', uninsuredAmount: 8200000, insuredOutcome: 'Burglary policy paid the stock loss after police report and stock records were submitted.', insuredAmount: 7380000, lesson: 'Keep stock records off-site and report to the police and your broker immediately — forcible entry evidence matters.' },
  motor: { title: 'The Lagos–Ibadan Expressway Crash', incident: 'A loaded 30-tonne truck lost its brakes and hit two cars, injuring three people.', uninsuredOutcome: 'Operator paid hospital bills, third-party repairs and the truck write-off personally.', uninsuredAmount: 61000000, insuredOutcome: 'Comprehensive Fleet paid the truck’s market value; third-party liability handled the injured parties.', insuredAmount: 52500000, lesson: 'Third-party cover is the legal minimum; comprehensive cover protects the asset that earns your income.' },
  life: { title: 'The Factory Supervisor', incident: 'A 41-year-old supervisor earning ₦4.8m a year died in a road accident on the way to work.', uninsuredOutcome: 'The employer faced a benefit claim it had to fund from cash flow, plus legal threats.', uninsuredAmount: 14400000, insuredOutcome: 'Group Life paid three times annual emolument to the beneficiaries within weeks of complete documents.', insuredAmount: 14400000, lesson: 'Update your Group Life staff schedule whenever salaries change — benefits follow the declared emoluments.' },
  bi: { title: 'Sealed for 90 Days', incident: 'After a small fire, a bakery in Port Harcourt was sealed for repairs and inspections for three months.', uninsuredOutcome: 'Paid rent, 18 salaries and loan instalments with zero income.', uninsuredAmount: 22500000, insuredOutcome: 'Business Interruption covered lost gross profit and increased cost of working.', insuredAmount: 20250000, lesson: 'Business Interruption must be bought together with your Fire policy — it cannot be added after the loss.' },
  property: { title: 'The Rented Duplex in Lekki', incident: 'A tenant’s faulty extension cable started a fire that destroyed the upper floor.', uninsuredOutcome: 'Landlord funded the rebuild and lost 9 months’ rent.', uninsuredAmount: 48000000, insuredOutcome: 'Fire policy on reinstatement basis paid rebuild cost; Loss of Rent extension paid the rent.', insuredAmount: 45600000, lesson: 'Insure the building at rebuild cost, not purchase price, and add Loss of Rent.' },
};

function mockCopilot(action, { book, chapter, chapterText, selection, notes }) {
  const topic = topicOf(chapter, chapterText);
  const cur = book.currency || 'NGN';
  const c = CASES[topic];
  const who = book.target_persona || 'business owners';
  switch (action) {
    case 'pain_hook':
      return { message: 'Opening hook drafted — insert at the top of the chapter.', blocks: [
        { type: 'painPoint', data: { badge: 'Picture this', severity: 'high', title: `It is 2:14 a.m. and your phone is ringing.`, body: `${c.incident} By sunrise the question is no longer “What happened?” but “How do we survive this?”` } },
        { type: 'paragraph', text: `If you are one of the many ${who} who has thought *“it won’t happen to me”*, this chapter is for you. Not to frighten you — but to make sure that if the call ever comes, you already know the answer.` },
      ] };
    case 'claim_scenario':
      return { message: 'Anonymised claim scenario generated (illustrative figures).', blocks: [
        { type: 'claimCase', data: { ...c, currency: cur } },
        { type: 'paragraph', text: `*Names and figures are illustrative; details have been changed to protect privacy.* The difference between the two outcomes — ${fmtMoney(c.uninsuredAmount, cur)} lost versus ${fmtMoney(c.insuredAmount, cur)} recovered — came down to decisions made months before the loss.` },
      ] };
    case 'simplify_jargon': {
      const text = `${selection} ${chapterText}`.toLowerCase();
      let found = GLOSSARY.filter(([t]) => text.includes(t.toLowerCase().split(' ')[0].replace(/[’']s?$/, '')));
      if (found.length < 2) found = GLOSSARY.filter(([t]) => ['Average Clause', 'No Premium, No Cover', 'Proximate Cause'].includes(t));
      const technical = {
        'Average Clause': 'If the property at the time of loss is of greater value than the sum insured, the insured shall be considered as being their own insurer for the difference and shall bear a rateable proportion of the loss.',
        'No Premium, No Cover': 'No insurance cover shall be granted where the premium has not been received by the insurer.',
        'Proximate Cause': 'The active, efficient cause that sets in motion a train of events which brings about a result, without the intervention of any force started and working actively from a new and independent source.',
        Subrogation: 'Upon payment of a claim the insurer shall be entitled to all rights and remedies of the insured against any third party in respect of the loss.',
        Indemnity: 'The insurer will indemnify the insured against loss or damage to the property described in the schedule.',
      };
      return { message: `Found ${Math.min(found.length, 4)} terms to translate.`, blocks: found.slice(0, 4).map(([term, plain]) => ({ type: 'jargon', data: { term, technical: technical[term] || `The policy wording for “${term}” as defined in your schedule.`, plain, example: '' } })) };
    }
    case 'summary_checklist':
      return { message: 'Summary & action checklist ready.', blocks: [
        { type: 'heading', level: 2, text: 'Chapter in a nutshell' },
        { type: 'bullets', items: [
          `The real risk is not the incident itself but being unable to recover from it.`,
          `Cover only works if premium is paid before the loss — *No Premium, No Cover*.`,
          `Under-insurance quietly reduces every claim through the Average Clause.`,
          `Prompt notification and good records are what get claims paid quickly.`,
          `A broker works for you — use them before, during and after a claim.`,
        ] },
        { type: 'riskChecklist', data: { title: 'Your action steps this week', intro: 'Tick each one when done.', items: [
          'Find your current policy schedule and check the sum insured',
          'Compare the sum insured with today’s replacement value',
          'Confirm premium has been paid and keep the receipt',
          'Save your broker’s claims number in your phone',
          'Photograph your premises, stock and equipment and store it in the cloud',
          'Book a free policy gap audit with your broker',
        ] } },
      ] };
    case 'draft_chapter':
    default: {
      const title = chapter.title || 'This chapter';
      return { message: 'First draft generated from your outline notes — edit freely.', blocks: [
        { type: 'paragraph', text: `${c.incident} It is the kind of story you hear at owners’ meetings, in market associations and on WhatsApp groups — and every time, someone says, *“God forbid.”* This chapter is about turning “God forbid” into a plan.` },
        ...(notes ? [{ type: 'quote', text: notes.slice(0, 400) }] : []),
        { type: 'painPoint', data: { badge: 'Real Risk', severity: 'high', title: 'The loss you can see is only half the loss', body: 'Behind every damaged building or stolen stock sits a second loss: weeks without income, staff to pay, loans to service and customers who drift to competitors.' } },
        { type: 'heading', level: 2, text: 'Why this risk is bigger than it looks' },
        { type: 'paragraph', text: `Most ${who} carry far more value in one place than they realise. Stock bought in dollars, equipment imported at today’s exchange rate and buildings that would cost twice as much to rebuild — all sitting behind one door, one roof and one electrical installation.` },
        { type: 'paragraph', text: `Insurance exists to move that risk off your balance sheet for a known, affordable price. But it only works when three things are true: the right cover is in place, it is for the right amount, and the premium has been paid.` },
        { type: 'mythFact', data: { myth: 'Insurance companies in Nigeria don’t pay claims.', fact: 'Insurers settle valid claims every day. Most disputes come from under-insurance, late notification, non-disclosure or unpaid premium — problems you can fix before a loss.' } },
        { type: 'heading', level: 2, text: 'The cover that solves it' },
        { type: 'comparison', data: { title: 'What responds when disaster strikes', columns: ['Cover', 'What it pays for', 'Watch out for'], rows: [
          ['Fire & Special Perils', 'Damage to buildings, stock and equipment from fire, lightning, explosion and named perils', 'Sum insured must reflect current value'],
          ['Business Interruption', 'Lost gross profit and extra costs while you recover', 'Must be bought alongside the Fire policy'],
          ['Burglary', 'Theft involving forcible entry or exit', 'Police report and stock records required'],
          ['Public Liability', 'Injury or damage to customers and visitors', 'Limits per incident and in total'],
        ] } },
        { type: 'jargon', data: { term: 'Average Clause', technical: 'Where the sum insured is less than the value of the property at the time of loss, the insured shall bear a rateable proportion of the loss.', plain: 'If you insure for less than the true value, every claim is cut by the same percentage.', example: `Stock worth ${fmtMoney(40000000, cur)} insured for ${fmtMoney(20000000, cur)}: a ${fmtMoney(10000000, cur)} loss pays ${fmtMoney(5000000, cur)}.` } },
        { type: 'heading', level: 2, text: 'What getting paid actually looks like' },
        { type: 'claimCase', data: { ...c, currency: cur } },
        { type: 'paragraph', text: `*Names and figures are illustrative.* The lesson from ${title.toLowerCase()} is simple: the decisions that determine your claim are made long before the loss — at purchase and at every renewal.` },
        { type: 'riskChecklist', data: { title: 'Your action steps', intro: 'Do these before you start the next chapter.', items: [
          'Value your stock and assets at today’s replacement cost',
          'Check that premium has been paid and receipted (No Premium, No Cover)',
          'Ask your broker whether Business Interruption is included',
          'Save your broker’s claims line and notify any loss immediately',
        ] } },
      ] };
    }
  }
}

// ---- Launch / sales copy -------------------------------------------------------------------

export async function generateSalesCopy({ book = {}, ctas = [] }) {
  const price = fmtMoney(book.price_amount || 7500, book.currency || 'NGN');
  if (!client) {
    const who = book.target_persona || 'Nigerian business owners';
    return {
      mode: 'mock',
      selar: {
        headline: `${book.title}: Stop Losing Sleep Over “What If?”`,
        subheadline: book.subtitle || 'A plain-English protection guide from a licensed insurance broker.',
        body: `One fire, one burglary or one rejected claim can erase years of hard work. *${book.title}* shows ${who.toLowerCase()} exactly which covers matter, how much to insure for, and how to make sure claims get paid — with real (anonymised) Naira case studies, checklists and a free policy audit for readers.`,
        bullets: [
          'The 7 reasons claims get rejected in Nigeria — and how to avoid every one',
          'How the Average Clause silently cuts your payout (and the 5-minute fix)',
          'What NIIRA 2025 and NAICOM rules mean for your business, in plain English',
          'Real case studies: uninsured vs. insured, in Naira',
          'Printable risk audit, renewal and claims checklists',
          'Bonus: free Policy Gap Audit on WhatsApp for readers',
        ],
        guarantee: 'Read it in a weekend. If it does not change how you protect your business, message us for a full refund within 7 days.',
        cta: `Get your copy today — ${price}`,
      },
      carousel: [
        { slide: 1, headline: 'Would your business survive one bad night?', body: 'Fire. Burglary. A rejected claim. Swipe →' },
        { slide: 2, headline: 'Most claims fail for 4 boring reasons', body: 'Under-insurance · Late notification · Unpaid premium · Non-disclosure' },
        { slide: 3, headline: 'The Average Clause trap', body: 'Insure ₦20m stock for ₦10m and every claim is cut in half.' },
        { slide: 4, headline: `New book: ${book.title}`, body: 'Plain-English guide + checklists + Naira case studies, from a licensed broker.' },
        { slide: 5, headline: `${price} — link in bio`, body: 'Readers get a free Policy Gap Audit on WhatsApp. Sleep soundly.' },
      ],
    };
  }
  const out = await callClaude(`${bookContext(book)}
Price: ${price}. CTAs: ${JSON.stringify(ctas.map((c) => ({ label: c.label, type: c.cta_type, promo: c.promo_code })))}
Write a Selar/landing page sales page and a 5-slide LinkedIn/Instagram carousel. Compliant: no guaranteed payouts, no "best insurer".
Return JSON {"selar":{"headline","subheadline","body","bullets":["6 bullets"],"guarantee","cta"},"carousel":[{"slide":1,"headline","body"}]}`);
  return { ...out, mode: 'live' };
}

export const audienceList = AUDIENCES;
