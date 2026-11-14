// NAICOM class-of-business groupings used on the returns. ERP classes map onto these via stg_classes.naicom_class.
const NAICOM_CLASSES = [
  { code: 'FIRE', name: 'Fire & Special Perils', category: 'non-life' },
  { code: 'GEN_ACCIDENT', name: 'General Accident', category: 'non-life' },
  { code: 'MOTOR', name: 'Motor', category: 'non-life' },
  { code: 'MARINE_CARGO', name: 'Marine Cargo', category: 'non-life' },
  { code: 'MARINE_HULL', name: 'Marine Hull', category: 'non-life' },
  { code: 'AVIATION', name: 'Aviation', category: 'non-life' },
  { code: 'OIL_GAS', name: 'Oil & Gas / Energy', category: 'non-life' },
  { code: 'ENGINEERING', name: 'Engineering', category: 'non-life' },
  { code: 'BOND', name: 'Bonds', category: 'non-life' },
  { code: 'AGRIC', name: 'Agricultural', category: 'non-life' },
  { code: 'MISC', name: 'Miscellaneous', category: 'non-life' },
  { code: 'HEALTH', name: 'Health / Medical', category: 'non-life' },
  { code: 'LIFE_GROUP', name: 'Group Life', category: 'life' },
  { code: 'LIFE_INDIVIDUAL', name: 'Individual Life', category: 'life' },
];
const CLASS_NAME = Object.fromEntries(NAICOM_CLASSES.map((c) => [c.code, c.name]));
module.exports = { NAICOM_CLASSES, CLASS_NAME };
