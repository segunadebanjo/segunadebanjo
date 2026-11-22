// Rule-based NAICOM / NIIRA 2025 market-conduct guardrail. Runs on every compliance check
// (with or without an API key). The AI review, when available, is merged on top of these findings.
import { docToText } from '../../shared/render.js';

const RULES = [
  { id: 'guarantee', severity: 'high', re: /\b((?<!fidelity |bank |performance |advance payment )guarantee[sd]?(?! (insurance|cover|policy|bond))|100% (paid|payout|covered|guaranteed))\b/gi,
    issue: 'Guaranteed-outcome language. Claims are paid subject to policy terms, so promising a guaranteed payout can mislead consumers.',
    rule: 'NAICOM Market Conduct & Business Practice Guidelines — fair, clear and not misleading communication',
    suggestion: 'Replace with conditional wording, e.g. “pays valid claims in line with the policy terms”.' },
  { id: 'always_pay', severity: 'high', re: /\b(always pays?|never (reject|decline|refuse)s?|no questions asked|instant(ly)? paid|pays? every claim)\b/gi,
    issue: 'Absolute claim-payment promise.', rule: 'Market conduct — claims representations must reflect policy conditions',
    suggestion: 'Say “valid claims are settled within the timelines set by NAICOM guidelines and the policy”.' },
  { id: 'risk_free', severity: 'medium', re: /\b(risk[- ]free|no risk at all|zero risk|fully protected from everything|covers? (everything|all risks? whatsoever))\b/gi,
    issue: 'Overstates the scope of cover. Every policy has exclusions, excesses and conditions.', rule: 'Disclosure of material limitations',
    suggestion: 'Mention that exclusions, excess/deductibles and conditions apply.' },
  { id: 'superlative', severity: 'medium', re: /\b(best|cheapest|number one|no\.? ?1|#1|lowest premium) (insurer|insurance company|policy|price|premium)s?\b/gi,
    issue: 'Unsubstantiated comparative claim about insurers or prices.', rule: 'Fair competition & accurate advertising',
    suggestion: 'Remove the superlative or cite an objective, dated source.' },
  { id: 'free_cover', severity: 'high', re: /\b(free (insurance|cover)|pay (later|after) (and|&) (get )?cover(ed)?|cover now,? pay later)\b/gi,
    issue: 'Implies cover without premium, which conflicts with the “No Premium, No Cover” principle.', rule: '“No Premium, No Cover” — cover attaches only on receipt of premium by the insurer',
    suggestion: 'State that cover begins only once premium has been received by the insurer.' },
  { id: 'unlicensed', severity: 'medium', re: /\b(any agent can|no licen[cs]e needed|unregistered (agent|broker))\b/gi,
    issue: 'Suggests insurance can be bought through unlicensed intermediaries.', rule: 'Only NAICOM-licensed insurers, brokers and agents may transact insurance business',
    suggestion: 'Encourage readers to verify licences on the NAICOM website.' },
  { id: 'returns', severity: 'medium', re: /\b(\d{1,3}% (return|interest|yield)s? (guaranteed|assured)|double your money)\b/gi,
    issue: 'Investment-return promise on a life/savings product.', rule: 'Benefit illustrations must be clearly marked as projections',
    suggestion: 'Label figures as illustrative projections, not guarantees.' },
  { id: 'legal_advice', severity: 'low', re: /\b(this is legal advice|you (must|will) win in court)\b/gi,
    issue: 'Presents content as legal advice.', rule: 'Educational content should not be presented as legal advice',
    suggestion: 'Add “speak to a qualified professional about your situation”.' },
];

function excerptAround(text, idx, len) {
  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + len + 60);
  return (start > 0 ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ').trim() + (end < text.length ? '…' : '');
}

export function ruleBasedCompliance(doc) {
  const text = typeof doc === 'string' ? doc : docToText(doc);
  const flags = [];
  for (const r of RULES) {
    r.re.lastIndex = 0;
    let m;
    let hits = 0;
    while ((m = r.re.exec(text)) && hits < 3) {
      hits++;
      flags.push({ severity: r.severity, excerpt: excerptAround(text, m.index, m[0].length), match: m[0], issue: r.issue, rule: r.rule, suggestion: r.suggestion, source: 'rules' });
    }
  }
  const lower = text.toLowerCase();
  const checks = [];
  const mentionsPremium = /premium/.test(lower);
  const mentionsClaims = /claim/.test(lower);
  const hasNaira = /₦\s?\d|naira|ngn/i.test(text);
  if (mentionsPremium && !/no premium,? no cover/.test(lower)) {
    flags.push({ severity: 'low', excerpt: '', issue: 'Premium is discussed but the “No Premium, No Cover” rule is not explained.', rule: '“No Premium, No Cover”', suggestion: 'Add one sentence explaining that cover starts only when the insurer receives the premium.', source: 'rules' });
  } else if (mentionsPremium) checks.push('“No Premium, No Cover” principle is explained.');
  if (mentionsClaims && !/(notif|report).{0,40}(immediately|promptly|within|as soon as)/.test(lower)) {
    flags.push({ severity: 'low', excerpt: '', issue: 'Claims are discussed without telling readers to notify promptly.', rule: 'Claims notification conditions', suggestion: 'Remind readers to notify their broker/insurer immediately and in writing.', source: 'rules' });
  } else if (mentionsClaims) checks.push('Prompt claim notification guidance is present.');
  if (hasNaira && /(case study|scenario|story|example)/.test(lower) && !/(illustrative|names (and|&) details|anonymi[sz]ed|composite|for illustration)/.test(lower)) {
    flags.push({ severity: 'low', excerpt: '', issue: 'Naira case figures are shown without saying they are illustrative/anonymised.', rule: 'Accuracy of claims representations & data privacy (NDPA 2023)', suggestion: 'Add “Names and figures are illustrative; details changed to protect privacy.”', source: 'rules' });
  }
  if (/group life/.test(lower)) checks.push('Mentions statutory Group Life — verify the minimum benefit wording against the Pension Reform Act 2014 and NIIRA 2025.');
  if (/(third[- ]party|motor)/.test(lower)) checks.push('Mentions motor cover — confirm compulsory Motor Third-Party limits against current NAICOM tariffs.');
  if (/(builder|occupier)/.test(lower)) checks.push('Mentions builders/occupiers liability — confirm which buildings fall under the compulsory insurance provisions.');

  const weights = { high: 18, medium: 9, low: 4 };
  const score = Math.max(0, 100 - flags.reduce((s, f) => s + (weights[f.severity] || 4), 0));
  return { score, flags, checks, words: (text.match(/\S+/g) || []).length };
}

export const RECOMMENDED_DISCLAIMER =
  'This chapter is for general education only and is not insurance, legal or financial advice. Cover is subject to the ' +
  'terms, conditions, exclusions and excess of the policy issued by the insurer, and starts only when premium has been ' +
  'received ("No Premium, No Cover"). Case studies are illustrative; names and figures have been changed. Insurance ' +
  'brokerage services are provided by a NAICOM-licensed broker.';
