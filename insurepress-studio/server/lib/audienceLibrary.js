// Curated pain-point library used by the Blueprint Wizard in mock mode and as grounding for the AI.
// Statutory notes are deliberately phrased at a general level; authors must verify specifics
// against current NAICOM circulars and the text of NIIRA 2025.

const pp = (title, fear, trigger, misconception, consequence, policies) => ({ title, fear, trigger, misconception, financialConsequence: consequence, policies });

export const AUDIENCE_LIBRARY = {
  sme: {
    label: 'Nigerian SMEs & Retail/Warehouse Owners',
    persona: 'Owner-managers of shops, warehouses, pharmacies and light manufacturers with 5–50 staff',
    painPoints: [
      pp('One fire wipes out the stock', 'Losing ten years of stock and savings in one night', 'Electrical faults, generator fuel storage, market fires', '“My landlord’s insurance covers my goods.”', 'Stock worth ₦20m–₦200m lost with no recovery; business closes', ['Fire & Special Perils', 'Business Interruption (Consequential Loss)']),
      pp('Burglary and staff theft', 'Coming to an empty shop on Monday morning', 'Weekend break-ins, collusion, weak locks', '“Theft is never covered.”', 'Cash and stock losses plus downtime', ['Burglary / Theft', 'Fidelity Guarantee', 'Money Insurance']),
      pp('Claims rejected for under-insurance', 'Paying premiums for years then getting a fraction of the loss', 'Old sums insured, inflation and naira devaluation', '“A small claim will be paid in full anyway.”', 'Average Clause cuts payouts by 30–60%', ['Fire & Special Perils with reinstatement value', 'Declaration policies']),
      pp('No premium, no cover', 'Discovering after a loss that the policy was never in force', 'Promising to “pay next week”, unremitted cash to agents', '“The insurer will cover me while I arrange payment.”', 'Entire claim declined', ['Any policy — premium must be paid before cover attaches']),
      pp('Shutdown after a loss', 'Rent, salaries and loans still due while the shop is closed', 'Fire, flood, government sealing after an incident', '“Fire insurance replaces my lost profit.”', 'Months of fixed costs with zero revenue', ['Business Interruption', 'Increased Cost of Working']),
      pp('Staff death or injury', 'A grieving family and a legal liability you cannot afford', 'Workplace accidents, road accidents on duty', '“Group Life is optional for small firms.”', 'Statutory compensation claims and reputational harm', ['Group Life Assurance (statutory)', 'Employees’ Compensation (NSITF)']),
      pp('Customer injured on premises', 'Being sued by a customer who slipped in your shop', 'Wet floors, falling goods, poor lighting', '“People in Nigeria don’t sue.”', 'Legal costs and settlements', ['Public Liability', 'Occupiers’ Liability']),
      pp('Late claim notification', 'Being told “you reported too late”', 'Waiting to tidy up or gather receipts before calling the broker', '“I can report whenever I am ready.”', 'Claim prejudiced or declined', ['Claims notification clause — every policy']),
    ],
  },
  fleet: {
    label: 'Commercial Fleet & Logistics Operators',
    persona: 'Haulage, last-mile delivery and ride-hailing fleet owners running 3–300 vehicles',
    painPoints: [
      pp('Truck crash with third-party injuries', 'A single accident bankrupting the business', 'Night driving, fatigue, poor roads', '“Third-party cover protects my truck.”', 'Own-vehicle loss plus third-party claims', ['Comprehensive Motor Fleet', 'Motor Third-Party (compulsory)']),
      pp('Goods lost in transit', 'Paying customers for cargo destroyed or stolen on the road', 'Hijacking, accidents, overturned trucks', '“The customer’s insurance covers their goods.”', 'Contractual liability for full cargo value', ['Goods-in-Transit', 'Marine Cargo (Inland)']),
      pp('Vehicle theft', 'A new truck disappearing from the park', 'Poor parking security, insider collusion', '“Tracker means I don’t need theft cover.”', 'Loss of an asset still under finance', ['Comprehensive Motor with tracker warranty']),
      pp('Driver deaths and injuries', 'Families demanding compensation after a fatal crash', 'Long-haul routes, banditry', '“Drivers are contractors, so I’m not liable.”', 'Compensation claims and statutory penalties', ['Group Personal Accident', 'Group Life (statutory)']),
      pp('Downtime after accidents', 'Contracts lost while trucks sit at the workshop', 'Slow claims, parts scarcity', '“Insurance pays for my lost hire income.”', 'Revenue loss and penalty clauses', ['Loss of Use extension', 'Fleet BI']),
      pp('Claims denied for unlicensed drivers', 'Claim rejected because a driver’s licence had expired', 'Poor driver records', '“Any driver I hire is automatically covered.”', 'Entire claim declined', ['Driver warranty compliance']),
    ],
  },
  hr: {
    label: 'HR Managers (Statutory Group Life & Employee Benefits)',
    persona: 'HR and admin managers in firms with 10–1,000 staff responsible for benefits compliance',
    painPoints: [
      pp('No Group Life when a staff member dies', 'Facing a bereaved family with nothing to offer', 'Unexpected deaths, road accidents', '“Group Life is a perk, not a legal duty.”', 'Out-of-pocket benefit payments and legal exposure', ['Group Life Assurance (statutory)']),
      pp('Sum assured based on old salaries', 'Benefits paid on last year’s salary list', 'Mid-year raises and new hires not declared', '“The insurer will use current salaries automatically.”', 'Under-payment and staff disputes', ['Group Life with regular schedule updates']),
      pp('Medical costs crushing morale', 'Staff borrowing for hospital bills', 'Inadequate HMO plans', '“NHIA/HMO covers everything.”', 'Absenteeism and attrition', ['Group Health / HMO top-up', 'Critical Illness']),
      pp('Key person leaving or dying', 'The business stalling when the MD is gone', 'Illness, accidents', '“We’re too small for keyman cover.”', 'Lost contracts and lender recalls', ['Keyman Assurance']),
      pp('Workplace injury claims', 'Compensation demands after a factory accident', 'Machinery, falls, transport', '“NSITF handles it all.”', 'Uninsured liabilities above statutory limits', ['Employer’s Liability', 'Group Personal Accident']),
      pp('Regulatory audits', 'Fines or contract disqualification for missing certificates', 'Government tenders, PenCom audits', '“Nobody checks.”', 'Lost tenders and penalties', ['Group Life certificate', 'Compliance pack']),
    ],
  },
  families: {
    label: 'Young Parents & Families',
    persona: 'Salary earners and young entrepreneurs aged 25–45 with children',
    painPoints: [
      pp('Leaving children with nothing', 'Children dropping out of school if a parent dies', 'Sudden illness, road accidents', '“Life insurance is for old people.”', 'Years of school fees and living costs unfunded', ['Term Life Assurance', 'Education Endowment']),
      pp('Hospital bills draining savings', 'A medical emergency wiping out savings', 'Surgery, maternity complications', '“My employer’s HMO is enough.”', 'Debt and sold assets', ['Health Insurance', 'Critical Illness']),
      pp('Home burglary or fire', 'Losing everything in the house', 'Break-ins, gas explosions', '“Home insurance is too expensive.”', 'Replacing contents from scratch', ['Householder’s Comprehensive']),
      pp('Car accident costs', 'Paying for repairs and the other driver', 'Lagos traffic, flooding', '“Third-party is enough.”', 'Repair and liability costs', ['Comprehensive Motor']),
      pp('Income stops after disability', 'Being unable to work and pay bills', 'Accidents, chronic illness', '“Disability won’t happen to me.”', 'Lost income for years', ['Personal Accident', 'Income Protection']),
      pp('Insurance company won’t pay', 'Paying premiums for nothing', 'Non-disclosure, lapsed policies', '“Insurers look for excuses.”', 'Declined claims', ['Proper disclosure & broker support']),
    ],
  },
  property: {
    label: 'Homeowners, Landlords & Builders (Occupiers & Builders Liability)',
    persona: 'Landlords, estate developers and owners building or renting out property',
    painPoints: [
      pp('Building collapse during construction', 'A collapse that kills workers or passers-by', 'Weak materials, poor supervision', '“The contractor carries all the risk.”', 'Criminal and civil liability, project loss', ['Builders’ Liability (compulsory for qualifying buildings)', 'Contractors’ All Risks']),
      pp('Tenant or visitor injured', 'Being sued after a staircase accident', 'Poor maintenance, faulty wiring', '“Tenants are responsible for themselves.”', 'Legal costs and damages', ['Occupiers’ Liability', 'Public Liability']),
      pp('Fire destroying a rental property', 'Losing the asset and the rent', 'Tenant cooking, electrical faults', '“Tenants’ insurance covers my building.”', 'Rebuild cost and lost rent', ['Fire & Special Perils', 'Loss of Rent']),
      pp('Flood damage', 'Annual floods ruining ground floors', 'Rainy season, blocked drains', '“Flood is never insurable.”', 'Repeated repair costs', ['Flood extension on Fire policy']),
      pp('Under-valued buildings', 'Claims paid on 2015 values in 2026', 'Inflation in building materials', '“My sum insured is fine.”', 'Average clause reductions', ['Reinstatement-value Fire policy']),
      pp('Mortgage lender demands', 'Loan delays because cover is missing', 'Bank conditions', '“The bank’s insurance protects me.”', 'Paying for cover that protects only the bank', ['Mortgage Protection', 'Fire with interest noted']),
    ],
  },
  diaspora: {
    label: 'Diaspora Property & Asset Investors',
    persona: 'Nigerians abroad investing in homes, land, vehicles and businesses back home',
    painPoints: [
      pp('Uninsured family home', 'Watching from abroad as a house burns', 'Caretaker neglect, electrical faults', '“My relatives will handle it.”', 'Total loss of a ₦100m+ asset', ['Householder’s / Fire policy']),
      pp('Projects abandoned mid-build', 'Money sent for construction disappearing', 'Contractor default, collapse', '“Insurance can’t help with builders.”', 'Lost funds and liability', ['Contractors’ All Risks', 'Builders’ Liability']),
      pp('Fraudulent policies', 'Paying for fake insurance certificates', 'Unlicensed agents', '“Any agent can sell insurance.”', 'No cover at all', ['Verify NAICOM-licensed brokers']),
      pp('Claims from a distance', 'Not knowing how to claim from London or Houston', 'Time zones, documentation', '“I must fly home to claim.”', 'Delayed or abandoned claims', ['Broker-managed claims']),
      pp('Parents’ health emergencies', 'Being called at 3 a.m. for hospital deposits', 'Ageing parents', '“I’ll just send money.”', 'Large unplanned transfers', ['Senior health plans']),
      pp('Currency risk on claims', 'Naira payouts losing value', 'Devaluation', '“Naira sums insured never need review.”', 'Under-insurance', ['Regular revaluation']),
    ],
  },
  hnw: {
    label: 'High-Net-Worth Professionals',
    persona: 'Doctors, lawyers, executives and founders with significant assets',
    painPoints: [
      pp('Professional negligence claims', 'A single lawsuit consuming a career’s savings', 'Errors, disputes', '“My employer covers me.”', 'Defence costs and damages', ['Professional Indemnity']),
      pp('Luxury assets uninsured', 'Jewellery, art and cars lost to theft', 'Home invasion, travel', '“Home insurance covers valuables.”', 'Uncovered high-value losses', ['All Risks for valuables', 'High-value Motor']),
      pp('Estate liquidity crunch', 'Heirs forced to sell assets to settle debts', 'Sudden death', '“My assets will take care of my family.”', 'Fire-sale of property', ['Whole Life', 'Keyman']),
      pp('Kidnap and travel risk', 'Being targeted while travelling', 'Security incidents', '“Nothing can be insured.”', 'Ransom and medical costs', ['Travel insurance', 'Specialist covers']),
      pp('Liability as a company director', 'Personal liability for company failures', 'Regulatory action', '“The company shields me.”', 'Personal asset exposure', ['Directors & Officers Liability']),
      pp('Fragmented policies', 'Ten policies, ten renewal dates, gaps in between', 'No central review', '“More policies mean more protection.”', 'Gaps and duplicated premiums', ['Annual portfolio audit']),
    ],
  },
};

export function libraryFor(audienceId, customLabel) {
  const lib = AUDIENCE_LIBRARY[audienceId] || AUDIENCE_LIBRARY.sme;
  return customLabel ? { ...lib, label: customLabel } : lib;
}
