import React, { useState, useEffect } from 'react';

// ============================================================================
// CLOUD STORAGE - Uses Netlify Functions (automatic with GitHub deploy)
// ============================================================================
// No configuration needed! Data is stored in Netlify Blobs automatically.
// Works across all devices and users.

// ============================================================================
// TYPES
// ============================================================================
interface FamilyMember {
  id: number;
  name: string;
  dob: string;
  gender: 'Male' | 'Female';
  sponsorship: string;
  relationship: string;
}

interface PlanBenefits {
  // New structure fields (optional for backward compatibility)
  areaOfCover?: string;
  annualLimit?: string;
  network?: string;
  consultationDeductible?: string;
  prescribedDrugs?: string;
  diagnostics?: string;
  preexistingCondition?: string;
  physiotherapy?: string;
  outpatientMaternity?: string;
  inpatientMaternity?: string;
  dental?: { enabled: boolean; value: string };
  optical?: { enabled: boolean; value: string };
  alternativeMedicine?: { enabled: boolean; value: string };
  // Legacy fields for backward compatibility
  inpatient?: string;
  outpatient?: string;
  emergency?: string;
  maternity?: string;
  preexisting?: { type: string; value: string };
  pharmacyLimit?: string;
  consultation?: string;
}

interface InsurancePlan {
  id: string;
  provider: string;
  plan: string;
  network: string;
  copay: string;
  premium: number;
  selected: boolean;
  status: 'none' | 'renewal' | 'recommended';
  benefits: PlanBenefits;
  isManual?: boolean;
  providerKey?: string;
  planLocation?: string;
  salaryCategory?: string;
}

interface MemberResult {
  member: FamilyMember;
  age: number;
  comparison: InsurancePlan[];
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
}

// ============================================================================
// LOCALSTORAGE KEYS FOR PERSISTENCE
// ============================================================================
const STORAGE_KEYS = {
  PLAN_EDITS: 'nsib_plan_edits',
  BENEFITS_EDITS: 'nsib_benefits_edits',
  REPORT_HISTORY: 'nsib_report_history',
  MANUAL_PLANS: 'nsib_manual_plans'
};

// ============================================================================
// DEFAULT BENEFITS
// ============================================================================
const defaultBenefits: PlanBenefits = {
  // New structure fields
  areaOfCover: '',
  annualLimit: 'As per policy schedule',
  network: '',
  consultationDeductible: '',
  prescribedDrugs: '',
  diagnostics: '',
  preexistingCondition: '',
  physiotherapy: '',
  outpatientMaternity: '',
  inpatientMaternity: '',
  dental: { enabled: true, value: '' },
  optical: { enabled: true, value: '' },
  alternativeMedicine: { enabled: false, value: '' },
  // Legacy fields for backward compatibility
  inpatient: 'Covered as per policy terms',
  outpatient: 'Covered as per policy terms',
  emergency: '24/7 Coverage',
  maternity: 'As per selected plan',
  preexisting: { type: 'standard', value: 'All pre-existing medical conditions should be declared in the Medical Application Form and is subject to medical underwriting.' },
  pharmacyLimit: '',
  consultation: ''
};

// ============================================================================
// PLAN-SPECIFIC BENEFITS DATABASE
// ============================================================================
const PLAN_BENEFITS: { [key: string]: PlanBenefits } = {
  // === ORIENT - DUBAI BASIC PLANS (BELOW 4K - LSB) ===
  'ORIENT_EMED_PCP_RN3': {
    inpatient: 'RN3 network. Covered with prior approval. 20% coinsurance max AED 1,000',
    outpatient: 'PCP network (clinics only). 20% coinsurance. GP referral for specialists',
    emergency: 'RN3 network for emergency',
    maternity: 'Married females 18-45. OP: 10% coinsurance 8 visits PHC. IP: 10% coinsurance max AED 10,000',
    dental: { enabled: true, value: 'Up to AED 500 with 30% coinsurance' },
    optical: { enabled: false, value: 'Not Covered' },
    preexisting: { type: 'underwriting', value: '6 months exclusion, then covered subject to declaration' },
    annualLimit: 'AED 150,000 on aggregate',
    alternativeMedicine: { enabled: false, value: 'Not Covered' },
    pharmacyLimit: 'Up to AED 2,000/year (20% coinsurance)',
    diagnostics: '20% coinsurance with prior approval',
    consultation: '20% coinsurance, GP referral required for specialists'
  },
  'ORIENT_EMED_PCPC': {
    inpatient: 'PCPC network. Covered with prior approval. 20% coinsurance max AED 1,000',
    outpatient: 'PCPC network (clinics only). 20% coinsurance. GP referral for specialists',
    emergency: 'PCPC network for emergency',
    maternity: 'Married females 18-45. OP: 10% coinsurance 8 visits PHC. IP: 10% coinsurance max AED 10,000',
    dental: { enabled: true, value: 'Up to AED 500 with 30% coinsurance' },
    optical: { enabled: false, value: 'Not Covered' },
    preexisting: { type: 'underwriting', value: '6 months exclusion, then covered subject to declaration' },
    annualLimit: 'AED 150,000 on aggregate',
    alternativeMedicine: { enabled: false, value: 'Not Covered' },
    pharmacyLimit: 'Up to AED 2,000/year (20% coinsurance)',
    diagnostics: '20% coinsurance with prior approval',
    consultation: '20% coinsurance, GP referral required for specialists'
  },
  'ORIENT_DMED_LSB': {
    inpatient: 'PCPC network. Covered with prior approval. 20% coinsurance',
    outpatient: 'PCPC network (clinics only). 20% coinsurance. GP referral for specialists',
    emergency: 'PCPC network for emergency',
    maternity: 'Married females 18-45. 10% coinsurance with limits. 10 months waiting period',
    dental: { enabled: true, value: 'Up to AED 500 with 30% coinsurance' },
    optical: { enabled: false, value: 'Not Covered' },
    preexisting: { type: 'underwriting', value: '6 months exclusion, then covered subject to declaration' },
    annualLimit: 'AED 150,000 on aggregate',
    alternativeMedicine: { enabled: false, value: 'Not Covered' },
    pharmacyLimit: 'Up to AED 2,000/year (20% coinsurance)',
    diagnostics: '20% coinsurance',
    consultation: '20% coinsurance, GP referral for specialists'
  },
  // === ORIENT - DUBAI BASIC PLANS (ABOVE 4K - NLSB) ===
  'ORIENT_DMED_NLSB': {
    inpatient: 'PCPC network. Covered with prior approval. 20% coinsurance',
    outpatient: 'PCPC network. 20% coinsurance. GP referral for specialists',
    emergency: 'PCPC network for emergency',
    maternity: 'Married females 18-45. OP: 8 visits (10% copay). IP: Up to AED 10,000 (10% copay). 10 months waiting',
    dental: { enabled: true, value: 'Up to AED 500 with 30% coinsurance' },
    optical: { enabled: false, value: 'Not Covered' },
    preexisting: { type: 'underwriting', value: '6 months exclusion, then covered subject to declaration' },
    annualLimit: 'AED 150,000 on aggregate',
    alternativeMedicine: { enabled: false, value: 'Not Covered' },
    pharmacyLimit: 'Up to AED 2,000/year (20% coinsurance)',
    diagnostics: '20% coinsurance',
    consultation: '20% coinsurance, GP referral for specialists'
  },
  'ORIENT_IMED': {
    inpatient: 'PCPC network. Covered with prior approval. 20% coinsurance',
    outpatient: 'PCPC network. 20% coinsurance. GP referral for specialists',
    emergency: 'PCPC network for emergency',
    maternity: 'Married females 18-45. 10% coinsurance with limits',
    dental: { enabled: true, value: 'Up to AED 500 with 30% coinsurance' },
    optical: { enabled: false, value: 'Not Covered' },
    preexisting: { type: 'underwriting', value: 'Subject to underwriting and declaration' },
    annualLimit: 'AED 150,000 on aggregate',
    alternativeMedicine: { enabled: false, value: 'Not Covered' },
    pharmacyLimit: 'Up to AED 2,000/year (20% coinsurance)',
    diagnostics: '20% coinsurance',
    consultation: '20% coinsurance'
  },
  // === ORIENT - NORTHERN EMIRATES BASIC PLANS ===
  'ORIENT_NEMED': {
    inpatient: 'RN3 network. Sublimit: AED 50,000 with 20% coinsurance, max AED 1,000',
    outpatient: 'NEXtCARE PCP (clinics only). Sublimit: AED 25,000 with 20% coinsurance',
    emergency: 'RN3 network for emergency',
    maternity: 'Married females 18-45. OP: 8 visits PHC, AED 2,500 limit, 20% copay. IP: AED 7,500, 15% copay. 12 months waiting',
    dental: { enabled: false, value: 'Not Covered' },
    optical: { enabled: false, value: 'Not Covered' },
    preexisting: { type: 'waiting', value: '12 months waiting period for first scheme membership' },
    annualLimit: 'AED 75,000 on aggregate; Sub-limits apply',
    alternativeMedicine: { enabled: false, value: 'Not Covered' },
    pharmacyLimit: 'Up to AED 1,000/year, 30% coinsurance, prior approval',
    diagnostics: '20% coinsurance',
    consultation: '20% coinsurance. Sublimit: AED 25,000'
  },
  'ORIENT_NEMED_LITE': {
    inpatient: 'RN3 network. Sublimit: AED 50,000 with 20% coinsurance',
    outpatient: 'NEXtCARE PCP (clinics only). 20% coinsurance',
    emergency: 'RN3 network for emergency',
    maternity: 'Married females 18-45. OP: 6 visits, AED 2,000. IP: AED 5,000. 12 months waiting',
    dental: { enabled: false, value: 'Not Covered' },
    optical: { enabled: false, value: 'Not Covered' },
    preexisting: { type: 'waiting', value: '12 months waiting period' },
    annualLimit: 'AED 75,000 on aggregate',
    alternativeMedicine: { enabled: false, value: 'Not Covered' },
    pharmacyLimit: 'Up to AED 500/year, 30% coinsurance',
    diagnostics: '20% coinsurance',
    consultation: '20% coinsurance'
  },
  // === WATANIA TAKAFUL ===
  'WATANIA_TAKAFUL_NE_PLAN1': {
    inpatient: 'NAS VN network. Covered with prior approval',
    outpatient: 'NAS VN network (clinics). 20% coinsurance, GP referral for specialists',
    emergency: 'NAS VN network for emergency',
    maternity: 'Married females 18-45. OP: 8 visits multiparas/10 visits primiparas (20% copay). IP: AED 7,500 normal/C-section',
    dental: { enabled: false, value: 'Not Covered' },
    optical: { enabled: false, value: 'Not Covered' },
    preexisting: { type: 'standard', value: 'Subject to underwriting and declaration' },
    annualLimit: 'AED 75,000 on aggregate',
    alternativeMedicine: { enabled: false, value: 'Not Covered' },
    pharmacyLimit: 'Up to AED 1,000/year (30% coinsurance)',
    diagnostics: '20% coinsurance',
    consultation: '20% coinsurance, GP referral required'
  },
  'WATANIA_TAKAFUL_NE_PLAN2': {
    inpatient: 'NAS VN network. Covered with prior approval',
    outpatient: 'NAS VN network (clinics). 20% coinsurance, GP referral for specialists',
    emergency: 'NAS VN network for emergency',
    maternity: 'Married females 18-45. OP: 8/10 visits (10% copay). IP: Up to AED 10,000 normal/C-section',
    dental: { enabled: false, value: 'Not Covered' },
    optical: { enabled: false, value: 'Not Covered' },
    preexisting: { type: 'standard', value: 'Subject to underwriting and declaration' },
    annualLimit: 'AED 150,000 on aggregate',
    alternativeMedicine: { enabled: false, value: 'Not Covered' },
    pharmacyLimit: 'Up to AED 1,500/year (30% coinsurance)',
    diagnostics: '10% coinsurance with prior approval',
    consultation: '20% coinsurance, GP referral required'
  },
  'WATANIA_TAKAFUL_DUBAI_BASIC': {
    inpatient: 'NAS VN network. Covered with prior approval',
    outpatient: 'NAS VN network (clinics). 20% coinsurance, GP referral for specialists',
    emergency: 'NAS VN network for emergency',
    maternity: 'Married females 18-45. OP: 8/10 visits (10% copay). IP: Up to AED 10,000 (10% copay)',
    dental: { enabled: true, value: 'AED 500 (30% coinsurance)' },
    optical: { enabled: false, value: 'Not Covered' },
    preexisting: { type: 'underwriting', value: '6 months exclusion, then covered up to AED 150,000' },
    annualLimit: 'AED 150,000 on aggregate',
    alternativeMedicine: { enabled: false, value: 'Not Covered' },
    pharmacyLimit: 'Up to AED 2,500/year (30% coinsurance)',
    diagnostics: '20% coinsurance',
    consultation: '20% coinsurance, GP referral required'
  },
  // === TAKAFUL EMARAT ===
  'TAKAFUL_EMARAT_RHODIUM': {
    inpatient: 'Worldwide coverage. AED 1 Million annual limit',
    outpatient: 'NEXTCARE GN+ network. 20% max AED 50 copay',
    emergency: 'Worldwide emergency coverage',
    maternity: 'OP: 15 visits, 8 ultrasounds (10% coinsurance). IP: Up to AED 20,000 (10% coinsurance)',
    dental: { enabled: true, value: 'Up to AED 3,000 (20% copay)' },
    optical: { enabled: true, value: 'Up to AED 1,500 (20% copay)' },
    preexisting: { type: 'covered', value: 'Covered up to AED 150,000/year. Must declare in MAF' },
    annualLimit: 'AED 1 Million',
    alternativeMedicine: { enabled: true, value: 'Up to AED 2,500/year (20% copay)' },
    pharmacyLimit: 'Up to AED 15,000 (15% coinsurance)',
    diagnostics: '10% copay for X-ray, MRI, CT-Scan, Ultrasound',
    consultation: '20% copay max AED 50'
  },
  'TAKAFUL_EMARAT_PLATINUM': {
    inpatient: 'Worldwide coverage. AED 1 Million annual limit',
    outpatient: 'NEXTCARE GN network. Nil Copay (fully covered)',
    emergency: 'Worldwide emergency coverage',
    maternity: 'OP: 15 visits, 8 ultrasounds (10% coinsurance). IP: Up to AED 20,000 (10% coinsurance)',
    dental: { enabled: true, value: 'Up to AED 3,000 (20% copay)' },
    optical: { enabled: true, value: 'Up to AED 1,500 (20% copay)' },
    preexisting: { type: 'covered', value: 'Covered up to AED 150,000/year. Must declare in MAF' },
    annualLimit: 'AED 1 Million',
    alternativeMedicine: { enabled: true, value: 'Up to AED 2,500/year (20% copay)' },
    pharmacyLimit: 'Up to AED 10,000 (0% - fully covered)',
    diagnostics: '0% copay (fully covered)',
    consultation: 'Nil Copay (fully covered)'
  },
  'TAKAFUL_EMARAT_GOLD': {
    inpatient: 'Worldwide coverage. AED 1 Million annual limit',
    outpatient: 'NEXTCARE RN network. Nil Copay (fully covered)',
    emergency: 'Worldwide emergency coverage',
    maternity: 'OP: 15 visits, 8 ultrasounds (10% coinsurance). IP: Up to AED 12,500 (10% coinsurance)',
    dental: { enabled: true, value: 'Up to AED 2,500 (20% copay)' },
    optical: { enabled: true, value: 'Up to AED 1,250 (20% copay)' },
    preexisting: { type: 'covered', value: 'Covered up to AED 150,000/year. Must declare in MAF' },
    annualLimit: 'AED 1 Million',
    alternativeMedicine: { enabled: true, value: 'Up to AED 2,500/year (20% copay)' },
    pharmacyLimit: 'Up to AED 7,500 (0% - fully covered)',
    diagnostics: '0% copay (fully covered)',
    consultation: 'Nil Copay (fully covered)'
  },
  'TAKAFUL_EMARAT_IRIDIUM': {
    inpatient: 'Worldwide coverage. AED 1 Million annual limit',
    outpatient: 'NEXTCARE RN2 network. 20% max AED 50 copay',
    emergency: 'Worldwide emergency coverage',
    maternity: 'OP: 12 visits, 6 ultrasounds (10% coinsurance). IP: Up to AED 12,500 (10% coinsurance)',
    dental: { enabled: true, value: 'Up to AED 1,500 (20% copay)' },
    optical: { enabled: true, value: 'Up to AED 1,000 (20% copay)' },
    preexisting: { type: 'covered', value: 'Covered up to AED 150,000/year. Must declare in MAF' },
    annualLimit: 'AED 1 Million',
    alternativeMedicine: { enabled: true, value: 'Up to AED 2,500/year (20% copay)' },
    pharmacyLimit: 'Up to AED 5,000 (15% coinsurance)',
    diagnostics: '10% copay',
    consultation: '20% copay max AED 50'
  },
  'TAKAFUL_EMARAT_SILVER': {
    inpatient: 'Worldwide coverage. AED 1 Million annual limit',
    outpatient: 'NEXTCARE RN3 network (clinics). 20% max AED 50 copay',
    emergency: 'Worldwide emergency coverage',
    maternity: 'OP: 10 visits, 4 ultrasounds (10% coinsurance). IP: AED 10,000 normal + AED 10,000 C-section',
    dental: { enabled: true, value: 'Up to AED 500 (30% copay)' },
    optical: { enabled: false, value: 'Not Covered' },
    preexisting: { type: 'covered', value: 'Covered up to AED 150,000/year. Must declare in MAF' },
    annualLimit: 'AED 1 Million',
    alternativeMedicine: { enabled: true, value: 'Up to AED 2,500/year (20% copay)' },
    pharmacyLimit: 'Up to AED 5,000 (15% coinsurance)',
    diagnostics: '10% copay',
    consultation: '20% copay max AED 50'
  },
  // === FIDELITY NE PLAN ===
  'FIDELITY_NE_BASIC': {
    inpatient: 'AAFIA TPA network. Covered as per policy',
    outpatient: 'AAFIA network clinics',
    emergency: 'AAFIA network',
    maternity: 'Subject to waiting period',
    dental: { enabled: false, value: 'Not Covered' },
    optical: { enabled: false, value: 'Not Covered' },
    preexisting: { type: 'waiting', value: '12 months waiting period' },
    annualLimit: 'AED 150,000 on aggregate',
    alternativeMedicine: { enabled: false, value: 'Not Covered' },
    pharmacyLimit: 'Included in OP limit',
    diagnostics: 'As per policy schedule',
    consultation: 'AAFIA network clinics'
  }
};

// ============================================================================
// INSURANCE DATABASE - COMPLETE WITH ORIENT BASIC PLANS
// ============================================================================
const INSURANCE_DB: { [key: string]: { [key: string]: { [key: string]: { M: number; F: number } } } } = {
  'ADAMJEE': {
    'ESSENTIAL_MEDNET_0': { '0-5': {M: 2394, F: 2394}, '6-17': {M: 1596, F: 1596}, '18-30': {M: 1796, F: 2994}, '31-40': {M: 2394, F: 3791}, '41-50': {M: 3192, F: 4290}, '51-60': {M: 4589, F: 5687}, '61-65': {M: 6586, F: 7884} },
    'ESSENTIAL_MEDNET_20': { '0-5': {M: 1916, F: 1916}, '6-17': {M: 1277, F: 1277}, '18-30': {M: 1437, F: 2395}, '31-40': {M: 1916, F: 3033}, '41-50': {M: 2554, F: 3432}, '51-60': {M: 3671, F: 4550}, '61-65': {M: 5269, F: 6307} },
    'SUPERIOR_MEDNET_0': { '0-5': {M: 3591, F: 3591}, '6-17': {M: 2394, F: 2394}, '18-30': {M: 2693, F: 4490}, '31-40': {M: 3591, F: 5687}, '41-50': {M: 4788, F: 6436}, '51-60': {M: 6884, F: 8530}, '61-65': {M: 9879, F: 11826} },
    'PREMIUM_MEDNET_0': { '0-5': {M: 4788, F: 4788}, '6-17': {M: 3192, F: 3192}, '18-30': {M: 3591, F: 5987}, '31-40': {M: 4788, F: 7583}, '41-50': {M: 6386, F: 8580}, '51-60': {M: 9179, F: 11374}, '61-65': {M: 13172, F: 15768} }
  },
  'FIDELITY': {
    'CLASSIC_NAS_0': { '0-5': {M: 2500, F: 2500}, '6-17': {M: 1800, F: 1800}, '18-30': {M: 2000, F: 3200}, '31-40': {M: 2600, F: 4100}, '41-50': {M: 3400, F: 4600}, '51-60': {M: 4900, F: 6100}, '61-65': {M: 7000, F: 8500} },
    'CLASSIC_NAS_10': { '0-5': {M: 2250, F: 2250}, '6-17': {M: 1620, F: 1620}, '18-30': {M: 1800, F: 2880}, '31-40': {M: 2340, F: 3690}, '41-50': {M: 3060, F: 4140}, '51-60': {M: 4410, F: 5490}, '61-65': {M: 6300, F: 7650} },
    'CLASSIC_NAS_20': { '0-5': {M: 2000, F: 2000}, '6-17': {M: 1440, F: 1440}, '18-30': {M: 1600, F: 2560}, '31-40': {M: 2080, F: 3280}, '41-50': {M: 2720, F: 3680}, '51-60': {M: 3920, F: 4880}, '61-65': {M: 5600, F: 6800} },
    'SILVER_NAS_0': { '0-5': {M: 3200, F: 3200}, '6-17': {M: 2300, F: 2300}, '18-30': {M: 2600, F: 4100}, '31-40': {M: 3400, F: 5300}, '41-50': {M: 4400, F: 6000}, '51-60': {M: 6400, F: 7900}, '61-65': {M: 9100, F: 11000} },
    'GOLD_NAS_0': { '0-5': {M: 4500, F: 4500}, '6-17': {M: 3200, F: 3200}, '18-30': {M: 3600, F: 5800}, '31-40': {M: 4700, F: 7400}, '41-50': {M: 6200, F: 8400}, '51-60': {M: 8900, F: 11100}, '61-65': {M: 12800, F: 15500} },
    'PLATINUM_NAS_0': { '0-5': {M: 6000, F: 6000}, '6-17': {M: 4300, F: 4300}, '18-30': {M: 4800, F: 7700}, '31-40': {M: 6300, F: 9900}, '41-50': {M: 8300, F: 11200}, '51-60': {M: 11900, F: 14800}, '61-65': {M: 17100, F: 20700} },
    'CLASSIC_NEXTCARE_0': { '0-5': {M: 2600, F: 2600}, '6-17': {M: 1900, F: 1900}, '18-30': {M: 2100, F: 3400}, '31-40': {M: 2700, F: 4300}, '41-50': {M: 3600, F: 4900}, '51-60': {M: 5200, F: 6400}, '61-65': {M: 7400, F: 9000} },
    'CLASSIC_NEXTCARE_10': { '0-5': {M: 2340, F: 2340}, '6-17': {M: 1710, F: 1710}, '18-30': {M: 1890, F: 3060}, '31-40': {M: 2430, F: 3870}, '41-50': {M: 3240, F: 4410}, '51-60': {M: 4680, F: 5760}, '61-65': {M: 6660, F: 8100} },
    'CLASSIC_NEXTCARE_20': { '0-5': {M: 2080, F: 2080}, '6-17': {M: 1520, F: 1520}, '18-30': {M: 1680, F: 2720}, '31-40': {M: 2160, F: 3440}, '41-50': {M: 2880, F: 3920}, '51-60': {M: 4160, F: 5120}, '61-65': {M: 5920, F: 7200} },
    'SILVER_NEXTCARE_0': { '0-5': {M: 3400, F: 3400}, '6-17': {M: 2500, F: 2500}, '18-30': {M: 2800, F: 4400}, '31-40': {M: 3600, F: 5700}, '41-50': {M: 4700, F: 6400}, '51-60': {M: 6800, F: 8400}, '61-65': {M: 9700, F: 11800} },
    'GOLD_NEXTCARE_0': { '0-5': {M: 4800, F: 4800}, '6-17': {M: 3400, F: 3400}, '18-30': {M: 3800, F: 6100}, '31-40': {M: 5000, F: 7900}, '41-50': {M: 6600, F: 8900}, '51-60': {M: 9500, F: 11800}, '61-65': {M: 13600, F: 16500} },
    'PLATINUM_NEXTCARE_0': { '0-5': {M: 6400, F: 6400}, '6-17': {M: 4600, F: 4600}, '18-30': {M: 5100, F: 8200}, '31-40': {M: 6700, F: 10500}, '41-50': {M: 8800, F: 11900}, '51-60': {M: 12700, F: 15700}, '61-65': {M: 18200, F: 22000} },
    'NE_BASIC': { '0-5': {M: 1200, F: 1200}, '6-17': {M: 900, F: 900}, '18-30': {M: 1000, F: 1600}, '31-40': {M: 1300, F: 2100}, '41-50': {M: 1700, F: 2300}, '51-60': {M: 2500, F: 3100}, '61-65': {M: 3500, F: 4300} }
  },
  // === ORIENT BASIC PLANS - COMPLETE ===
  'ORIENT': {
    // DUBAI - Below 4K AED (LSB - Low Salary Band)
    'EMED_PCP_RN3_DXB_LSB': { '18-90': {M: 725, F: 725} },
    'EMED_PCPC_DXB_LSB': { '18-91': {M: 700, F: 700} },
    'DMED_LSB': { '0-90': {M: 725, F: 725} },
    // DUBAI - Above 4K AED (NLSB - Non-Low Salary Band)
    'DMED_NLSB_CHILD': { '0-5': {M: 1325, F: 1325} },
    'DMED_NLSB_YOUNG': { '6-25': {M: 1182, F: 1182} },
    'DMED_NLSB_FEMALE': { '26-28': {M: 1182, F: 1182} },
    'DMED_NLSB_MARRIED_F': { '18-60': {M: 2559, F: 2559} },
    'DMED_NLSB_FEMALE_MAT': { '18-45': {M: 2889, F: 2889}, '46-60': {M: 2559, F: 2559}, '61-90': {M: 5946, F: 5946} },
    'DMED_NLSB_PARENTS': { '0-90': {M: 5946, F: 5946} },
    'IMED_DXB': { '18-65': {M: 1082, F: 1082} },
    // NORTHERN EMIRATES - NEMED
    'NEMED_CHILD': { '0-1': {M: 748, F: 748}, '2-17': {M: 480, F: 480} },
    'NEMED_ADULT': { '18-25': {M: 480, F: 480}, '18-35': {M: 480, F: 480}, '36-45': {M: 480, F: 480}, '46-60': {M: 841, F: 841}, '61-99': {M: 1099, F: 1099} },
    'NEMED_PARENTS': { '0-90': {M: 3774, F: 3774} },
    // NORTHERN EMIRATES - NEMED LITE
    'NEMED_LITE_CHILD': { '0-1': {M: 561, F: 561}, '2-17': {M: 361, F: 361} },
    'NEMED_LITE_ADULT': { '18-25': {M: 361, F: 361}, '18-35': {M: 361, F: 361}, '36-45': {M: 361, F: 361}, '46-60': {M: 630, F: 630}, '61-99': {M: 820, F: 820} },
    'NEMED_LITE_PARENTS': { '0-90': {M: 3316, F: 3316} }
  },
  'ORIENT_TAKAFUL': {
    'CLASSIC_DXB_20': { '0-1': {M: 8760, F: 8760}, '2-5': {M: 5260, F: 5260}, '6-15': {M: 3860, F: 3860}, '16-20': {M: 4140, F: 4770}, '21-25': {M: 4290, F: 9730}, '26-30': {M: 4780, F: 10990}, '31-35': {M: 5260, F: 12250}, '36-40': {M: 6210, F: 13000}, '41-45': {M: 7630, F: 12250}, '46-50': {M: 10890, F: 14040}, '51-55': {M: 14630, F: 16550}, '56-60': {M: 19430, F: 18720}, '61-65': {M: 23640, F: 20880} },
    'CLASSIC_DXB_0': { '0-1': {M: 9920, F: 9920}, '2-5': {M: 6420, F: 6420}, '6-15': {M: 5020, F: 5020}, '16-20': {M: 5300, F: 5930}, '21-25': {M: 5450, F: 10890}, '26-30': {M: 5940, F: 12150}, '31-35': {M: 6420, F: 13410}, '36-40': {M: 7370, F: 14160}, '41-45': {M: 8790, F: 13410}, '46-50': {M: 12050, F: 15200}, '51-55': {M: 15790, F: 17710}, '56-60': {M: 20590, F: 19880}, '61-65': {M: 24800, F: 22040} },
    'CLASSIC_NE_20': { '0-1': {M: 6010, F: 6010}, '2-5': {M: 3610, F: 3610}, '6-15': {M: 2650, F: 2650}, '16-20': {M: 2840, F: 3280}, '21-25': {M: 2950, F: 6680}, '26-30': {M: 3280, F: 7550}, '31-35': {M: 3610, F: 8410}, '36-40': {M: 4260, F: 8930}, '41-45': {M: 5240, F: 8410}, '46-50': {M: 7480, F: 9640}, '51-55': {M: 10050, F: 11370}, '56-60': {M: 13340, F: 12860}, '61-65': {M: 16240, F: 14340} },
    'CLASSIC_NE_0': { '0-1': {M: 6810, F: 6810}, '2-5': {M: 4410, F: 4410}, '6-15': {M: 3450, F: 3450}, '16-20': {M: 3640, F: 4080}, '21-25': {M: 3750, F: 7480}, '26-30': {M: 4080, F: 8350}, '31-35': {M: 4410, F: 9210}, '36-40': {M: 5060, F: 9730}, '41-45': {M: 6040, F: 9210}, '46-50': {M: 8280, F: 10440}, '51-55': {M: 10850, F: 12170}, '56-60': {M: 14140, F: 13660}, '61-65': {M: 17040, F: 15140} }
  },
  'RAK': {
    'HEALTH_PLUS_DXB_0': { '0-5': {M: 1890, F: 1890}, '6-17': {M: 1470, F: 1470}, '18-30': {M: 1680, F: 2520}, '31-40': {M: 2100, F: 3150}, '41-50': {M: 2940, F: 3570}, '51-60': {M: 4200, F: 4620}, '61-65': {M: 5880, F: 6300} },
    'HEALTH_PLUS_NE_0': { '0-5': {M: 1575, F: 1575}, '6-17': {M: 1155, F: 1155}, '18-30': {M: 1365, F: 2205}, '31-40': {M: 1785, F: 2835}, '41-50': {M: 2625, F: 3255}, '51-60': {M: 3885, F: 4305}, '61-65': {M: 5565, F: 5985} },
    'FAMILY_CARE_DXB_0': { '0-5': {M: 1575, F: 1575}, '6-17': {M: 1155, F: 1155}, '18-30': {M: 1365, F: 2205}, '31-40': {M: 1785, F: 2835}, '41-50': {M: 2625, F: 3255}, '51-60': {M: 3885, F: 4305}, '61-65': {M: 5565, F: 5985} },
    'FAMILY_CARE_NE_0': { '0-5': {M: 1260, F: 1260}, '6-17': {M: 924, F: 924}, '18-30': {M: 1092, F: 1764}, '31-40': {M: 1428, F: 2268}, '41-50': {M: 2100, F: 2604}, '51-60': {M: 3108, F: 3444}, '61-65': {M: 4452, F: 4788} }
  },
  'WATANIA_TAKAFUL': {
    'NE_PLAN1': { '0-45': {M: 534, F: 534}, '46-65': {M: 922, F: 922}, '66-99': {M: 3388, F: 3388} },
    'NE_PLAN2': { '0-45': {M: 663, F: 663}, '46-65': {M: 1166, F: 1166}, '66-99': {M: 4517, F: 4517} },
    'DUBAI_BASIC': { '0-5': {M: 670, F: 670}, '6-15': {M: 600, F: 600}, '16-20': {M: 750, F: 870}, '21-30': {M: 944, F: 1250}, '31-40': {M: 1050, F: 1400}, '41-50': {M: 1280, F: 1550}, '51-60': {M: 1680, F: 1850}, '61-65': {M: 2200, F: 2650} }
  },
  'TAKAFUL_EMARAT': {
    'RHODIUM': { '0-5': {M: 4500, F: 4500}, '6-15': {M: 4000, F: 4000}, '16-20': {M: 5000, F: 5800}, '21-30': {M: 6323, F: 8500}, '31-40': {M: 7000, F: 9000}, '41-50': {M: 8500, F: 10000}, '51-60': {M: 11000, F: 12000}, '61-65': {M: 15000, F: 18000} },
    'PLATINUM': { '0-5': {M: 18000, F: 18000}, '6-15': {M: 16000, F: 16000}, '16-20': {M: 20000, F: 23000}, '21-30': {M: 25037, F: 32000}, '31-40': {M: 28000, F: 35000}, '41-50': {M: 33000, F: 38000}, '51-60': {M: 42000, F: 45000}, '61-65': {M: 55000, F: 65000} },
    'GOLD': { '0-5': {M: 6200, F: 6200}, '6-15': {M: 5500, F: 5500}, '16-20': {M: 7000, F: 8000}, '21-30': {M: 8738, F: 11000}, '31-40': {M: 9800, F: 12500}, '41-50': {M: 11500, F: 14000}, '51-60': {M: 15000, F: 17000}, '61-65': {M: 20000, F: 24000} },
    'IRIDIUM': { '0-5': {M: 10800, F: 10800}, '6-15': {M: 9600, F: 9600}, '16-20': {M: 12000, F: 14000}, '21-30': {M: 15201, F: 19000}, '31-40': {M: 17000, F: 21000}, '41-50': {M: 20000, F: 24000}, '51-60': {M: 26000, F: 29000}, '61-65': {M: 34000, F: 40000} },
    'SILVER': { '0-5': {M: 2500, F: 2500}, '6-15': {M: 2200, F: 2200}, '16-20': {M: 2800, F: 3200}, '21-30': {M: 3456, F: 4500}, '31-40': {M: 3900, F: 5000}, '41-50': {M: 4600, F: 5800}, '51-60': {M: 6000, F: 7000}, '61-65': {M: 8000, F: 9500} }
  },
  'UFIC': {
    'PLAN_A1_IP_NE': { '0-1': {M: 283, F: 283}, '2-17': {M: 283, F: 283}, '18-35': {M: 357, F: 357}, '36-45': {M: 424, F: 424}, '46-59': {M: 424, F: 424}, '60-65': {M: 1100, F: 1100}, '66-70': {M: 1200, F: 1200}, '71-75': {M: 1800, F: 1800}, '76-80': {M: 2700, F: 2700}, '81-99': {M: 4050, F: 4050} },
    'PLAN_A_NE': { '0-1': {M: 750, F: 750}, '2-17': {M: 472, F: 472}, '18-45': {M: 472, F: 472}, '46-59': {M: 847, F: 847}, '60-65': {M: 1337, F: 1337}, '66-70': {M: 1560, F: 1560}, '71-75': {M: 2340, F: 2340}, '76-80': {M: 3510, F: 3510}, '81-99': {M: 5265, F: 5265} },
    'PLAN_LITE_NE': { '0-1': {M: 633, F: 633}, '2-17': {M: 397, F: 397}, '18-45': {M: 397, F: 397}, '46-59': {M: 714, F: 714}, '60-65': {M: 1127, F: 1127}, '66-70': {M: 1315, F: 1315}, '71-75': {M: 1973, F: 1973}, '76-80': {M: 2960, F: 2960}, '81-99': {M: 4440, F: 4440} },
    'PLAN_B_NE': { '0-1': {M: 945, F: 945}, '2-17': {M: 595, F: 595}, '18-45': {M: 595, F: 595}, '46-59': {M: 1068, F: 1068}, '60-65': {M: 1685, F: 1685}, '66-70': {M: 1965, F: 1965}, '71-75': {M: 2948, F: 2948}, '76-80': {M: 4421, F: 4421}, '81-99': {M: 6632, F: 6632} }
  }
};

// Manual providers
const MANUAL_PROVIDERS = [
  { id: 'AL_SAGR', name: 'AL SAGR NATIONAL', networks: ['MEDNET', 'NEXTCARE', 'NAS'] },
  { id: 'CIGNA', name: 'CIGNA', networks: ['CIGNA Network'] },
  { id: 'BUPA', name: 'BUPA', networks: ['BUPA Network'] },
  { id: 'HENSMERKUR', name: 'HENSMERKUR', networks: ['HENSMERKUR Network'] },
  { id: 'TAKAFUL_EMARAT_MANUAL', name: 'TAKAFUL EMARAT', networks: ['MEDNET', 'NEXTCARE', 'NAS', 'AAFIYA', 'ECARE', 'NE BASIC PLAN'] },
  { id: 'MEDGULF', name: 'MEDGULF', networks: ['MEDNET', 'NEXTCARE', 'NAS'] },
  { id: 'LIVA', name: 'LIVA', networks: ['MEDNET', 'NAS', 'Inayah'] },
  { id: 'SUKOON', name: 'SUKOON', networks: ['SUKOON Network', 'SAFE', 'HOME', 'HOMELITE', 'PRO', 'PRIME', 'MAX'] },
  { id: 'DIC', name: 'DIC', networks: ['MEDNET', 'DUBAICARE'] },
  { id: 'ORIENT_MANUAL', name: 'ORIENT', networks: ['Orient/Nextcare', 'PCPC', 'RN3', 'NEXTCARE', 'MEDNET'] },
  { id: 'ADAMJEE', name: 'ADAMJEE', networks: ['MEDNET', 'NEXTCARE', 'NAS'] },
  { id: 'FIDELITY_MANUAL', name: 'FIDELITY', networks: ['AAFIA TPA', 'MEDNET', 'NAS', 'NEXTCARE'] },
  { id: 'DUBAI_INSURANCE', name: 'DUBAI INSURANCE', networks: ['MEDNET', 'NEXTCARE', 'NAS', 'DUBAICARE'] },
  { id: 'RAK', name: 'RAK', networks: ['MEDNET', 'NEXTCARE', 'NAS'] },
  { id: 'WATANIA_TAKAFUL_MANUAL', name: 'WATANIA TAKAFUL', networks: ['NAS/Mednet TPA', 'MEDNET', 'NAS'] },
  { id: 'QATAR_INSURANCE', name: 'QATAR INSURANCE', networks: ['MEDNET', 'NEXTCARE', 'NAS'] }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
const calculateAge = (dob: string): number => {
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const getAutoRelationship = (age: number, sponsorship: string): string => {
  if (sponsorship === 'Principal') return 'Self';
  if (sponsorship === 'Wife' || sponsorship === 'Husband') return 'Spouse';
  if (sponsorship === 'Father' || sponsorship === 'Mother') return age >= 18 ? 'Parent' : 'Other';
  if (age < 18) return 'Child';
  if (age >= 18 && age < 25) return 'Dependent';
  return 'Other';
};

const findAgeBand = (age: number, provider: string, plan: string): string | null => {
  const providerData = INSURANCE_DB[provider];
  if (!providerData) return null;
  
  const planData = providerData[plan];
  if (!planData) return null;
  
  const bands = Object.keys(planData);
  for (const band of bands) {
    if (band.includes('-')) {
      const [min, max] = band.split('-').map(Number);
      if (age >= min && age <= max) return band;
    } else {
      const singleAge = parseInt(band);
      if (age === singleAge) return band;
    }
  }
  return null;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function InsurancePortal() {
  // Family members
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([
    { id: 1, name: '', dob: '', gender: 'Male', sponsorship: 'Principal', relationship: 'Self' }
  ]);
  
  // Shared settings
  const [sharedSettings, setSharedSettings] = useState({
    location: 'Dubai',
    salaryCategory: 'below4000'
  });
  
  // Results
  const [memberResults, setMemberResults] = useState<{ [key: number]: MemberResult }>({});
  const [expandedMembers, setExpandedMembers] = useState<{ [key: number]: boolean }>({});
  const [showSelected, setShowSelected] = useState<{ [key: number]: boolean }>({});
  
  // Benefits editing
  const [showBenefits, setShowBenefits] = useState<{ [key: string]: boolean }>({});
  const [editingBenefits, setEditingBenefits] = useState<{ [key: string]: PlanBenefits }>({});
  
  // Cloud benefits
  const [cloudBenefits, setCloudBenefits] = useState<{ [key: string]: PlanBenefits }>({});
  
  // LOCAL PERSISTENT EDITS - These survive page refresh
  const [localPlanEdits, setLocalPlanEdits] = useState<{ [planId: string]: { plan?: string; network?: string; copay?: string; premium?: number } }>({});
  const [localBenefitsEdits, setLocalBenefitsEdits] = useState<{ [planId: string]: PlanBenefits }>({});
  
  // Manual plans
  const [manualPlans, setManualPlans] = useState<{ [key: string]: any[] }>({});
  const [showManualPlanModal, setShowManualPlanModal] = useState(false);
  const [currentProvider, setCurrentProvider] = useState('');
  const [newManualPlan, setNewManualPlan] = useState({ planName: '', network: '', copay: '', premium: '' });
  
  // Edit plan
  const [editingResultPlan, setEditingResultPlan] = useState<any>(null);
  const [showEditResultPlanModal, setShowEditResultPlanModal] = useState(false);
  
  // Report
  const [advisorComment, setAdvisorComment] = useState('');
  const [reportHistory, setReportHistory] = useState<any[]>([]);
  const [showReportHistory, setShowReportHistory] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // SEARCH FILTERS
  const [providerSearch, setProviderSearch] = useState('');
  const [planSearch, setPlanSearch] = useState('');
  const [networkSearch, setNetworkSearch] = useState('');

  // Load benefits and history
  useEffect(() => {
    // Load local plan edits from localStorage
    try {
      const savedPlanEdits = localStorage.getItem(STORAGE_KEYS.PLAN_EDITS);
      if (savedPlanEdits) {
        setLocalPlanEdits(JSON.parse(savedPlanEdits));
      }
    } catch (e) {
      console.error('Error loading plan edits:', e);
    }

    // Load local benefits edits from localStorage
    try {
      const savedBenefitsEdits = localStorage.getItem(STORAGE_KEYS.BENEFITS_EDITS);
      if (savedBenefitsEdits) {
        setLocalBenefitsEdits(JSON.parse(savedBenefitsEdits));
      }
    } catch (e) {
      console.error('Error loading benefits edits:', e);
    }

    // Load manual plans from localStorage
    try {
      const savedManualPlans = localStorage.getItem(STORAGE_KEYS.MANUAL_PLANS);
      if (savedManualPlans) {
        setManualPlans(JSON.parse(savedManualPlans));
      }
    } catch (e) {
      console.error('Error loading manual plans:', e);
    }

    // Load cloud benefits
    const loadCloudBenefits = async () => {
      try {
        const response = await fetch('/api/benefits');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.benefits) {
            const cleanBenefits: { [key: string]: PlanBenefits } = {};
            Object.keys(data.benefits).forEach(key => {
              const { _updatedAt, ...benefitData } = data.benefits[key];
              cleanBenefits[key] = benefitData as PlanBenefits;
            });
            setCloudBenefits(cleanBenefits);
          }
        }
      } catch (error) {
        console.error('Error loading cloud benefits:', error);
      }
    };
    loadCloudBenefits();

    // Load cloud manual plans
    const loadCloudManualPlans = async () => {
      try {
        const response = await fetch('/api/manual-plans');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.plans) {
            setManualPlans(data.plans);
          }
        }
      } catch (error) {
        console.error('Error loading cloud manual plans:', error);
      }
    };
    loadCloudManualPlans();
    
    // Load local history
    try {
      const history = localStorage.getItem(STORAGE_KEYS.REPORT_HISTORY);
      if (history) setReportHistory(JSON.parse(history));
    } catch (e) {
      console.error('Error loading history:', e);
    }
  }, []);

  // Save plan edits to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(localPlanEdits).length > 0) {
      localStorage.setItem(STORAGE_KEYS.PLAN_EDITS, JSON.stringify(localPlanEdits));
    }
  }, [localPlanEdits]);

  // Save benefits edits to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(localBenefitsEdits).length > 0) {
      localStorage.setItem(STORAGE_KEYS.BENEFITS_EDITS, JSON.stringify(localBenefitsEdits));
    }
  }, [localBenefitsEdits]);

  // Save manual plans to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MANUAL_PLANS, JSON.stringify(manualPlans));
  }, [manualPlans]);

  // Get plan benefits with local overrides
  const getPlanBenefits = (provider: string, planName: string, planId?: string): PlanBenefits => {
    // First check local edits (highest priority)
    if (planId && localBenefitsEdits[planId]) {
      return { ...localBenefitsEdits[planId] };
    }
    
    const planKey = `${provider}_${planName}`;
    if (cloudBenefits[planKey]) return { ...cloudBenefits[planKey] };
    if (PLAN_BENEFITS[planKey]) return { ...PLAN_BENEFITS[planKey] };
    
    // Check partial matches
    const benefitKeys = Object.keys(PLAN_BENEFITS);
    for (const key of benefitKeys) {
      if (planName.includes(key.split('_').pop() || '')) {
        return { ...PLAN_BENEFITS[key] };
      }
    }
    
    return { ...defaultBenefits };
  };

  // Apply local plan edits to a plan
  const applyLocalEdits = (plan: InsurancePlan): InsurancePlan => {
    const edits = localPlanEdits[plan.id];
    const benefitsEdits = localBenefitsEdits[plan.id];
    
    if (!edits && !benefitsEdits) return plan;
    
    return {
      ...plan,
      plan: edits?.plan || plan.plan,
      network: edits?.network || plan.network,
      copay: edits?.copay || plan.copay,
      premium: edits?.premium !== undefined ? edits.premium : plan.premium,
      benefits: benefitsEdits || plan.benefits
    };
  };

  // Auto-update relationship when DOB changes
  const updateFamilyMember = (id: number, field: string, value: string) => {
    setFamilyMembers(prev => prev.map(m => {
      if (m.id !== id) return m;
      
      const updated = { ...m, [field]: value };
      
      // Auto-update relationship based on age
      if (field === 'dob' && value) {
        const age = calculateAge(value);
        updated.relationship = getAutoRelationship(age, updated.sponsorship);
      }
      if (field === 'sponsorship') {
        if (updated.dob) {
          const age = calculateAge(updated.dob);
          updated.relationship = getAutoRelationship(age, value);
        }
      }
      
      return updated;
    }));
  };

  // Add family member
  const addFamilyMember = () => {
    setFamilyMembers([...familyMembers, {
      id: Date.now(),
      name: '',
      dob: '',
      gender: 'Male',
      sponsorship: 'Dependent',
      relationship: 'Other'
    }]);
  };

  // Remove family member
  const removeFamilyMember = (id: number) => {
    if (familyMembers.length === 1) {
      alert('You must have at least one family member');
      return;
    }
    setFamilyMembers(familyMembers.filter(m => m.id !== id));
  };

  // Add manual plan
  const addManualPlan = async () => {
    if (!newManualPlan.planName || !newManualPlan.premium) {
      alert('Please enter plan name and premium');
      return;
    }
    const providerName = MANUAL_PROVIDERS.find(p => p.id === currentProvider)?.name || currentProvider;
    const plan: InsurancePlan = {
      id: `${currentProvider}_${Date.now()}`,
      provider: providerName,
      plan: newManualPlan.planName,
      network: newManualPlan.network || 'Standard',
      copay: newManualPlan.copay || 'Variable',
      premium: parseFloat(newManualPlan.premium),
      selected: false,
      status: 'none' as const,
      benefits: { ...defaultBenefits },
      isManual: true,
      providerKey: currentProvider
    };
    
    // Add to manualPlans state
    const updatedManualPlans = {
      ...manualPlans,
      [currentProvider]: [...(manualPlans[currentProvider] || []), plan]
    };
    setManualPlans(updatedManualPlans);
    
    // Also add to memberResults if search has been done
    if (Object.keys(memberResults).length > 0) {
      setMemberResults(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          const memberId = parseInt(key);
          // Add the manual plan to each member's comparison list
          const existingPlans = updated[memberId].comparison;
          const newComparison = [...existingPlans, { ...plan }];
          // Sort by premium
          newComparison.sort((a, b) => a.premium - b.premium);
          updated[memberId] = {
            ...updated[memberId],
            comparison: newComparison
          };
        });
        return updated;
      });
    }
    
    // Save to cloud for persistence and sharing
    try {
      await fetch('/api/manual-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plans: updatedManualPlans })
      });
      setNewManualPlan({ planName: '', network: '', copay: '', premium: '' });
      setShowManualPlanModal(false);
      alert('✅ Plan added and saved! It will be visible to anyone with this link.');
    } catch (error) {
      console.error('Error saving to cloud:', error);
      setNewManualPlan({ planName: '', network: '', copay: '', premium: '' });
      setShowManualPlanModal(false);
      alert('✅ Plan added locally. Cloud sync may be unavailable.');
    }
  };

  // Delete manual plan
  const deleteManualPlan = async (providerKey: string, planId: string) => {
    // Remove from manualPlans state
    const updatedManualPlans = {
      ...manualPlans,
      [providerKey]: manualPlans[providerKey]?.filter(p => p.id !== planId) || []
    };
    setManualPlans(updatedManualPlans);
    
    // Also remove from memberResults if search has been done
    if (Object.keys(memberResults).length > 0) {
      setMemberResults(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          const memberId = parseInt(key);
          updated[memberId] = {
            ...updated[memberId],
            comparison: updated[memberId].comparison.filter(p => p.id !== planId)
          };
        });
        return updated;
      });
    }
    
    // Save updated plans to cloud
    try {
      await fetch('/api/manual-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plans: updatedManualPlans })
      });
    } catch (error) {
      console.error('Error saving to cloud:', error);
    }
  };

  // Search plans
  const searchPlans = () => {
    const invalidMembers = familyMembers.filter(m => !m.dob);
    if (invalidMembers.length > 0) {
      alert('Please enter date of birth for all family members');
      return;
    }

    const isDubai = sharedSettings.location === 'Dubai';
    const isBelowSalary = sharedSettings.salaryCategory === 'below4000';
    const newMemberResults: { [key: number]: MemberResult } = {};

    familyMembers.forEach(member => {
      const age = calculateAge(member.dob);
      if (age < 0 || age > 100) {
        alert(`Age must be between 0 and 100 years for ${member.name || 'family member'}`);
        return;
      }

      const genderKey = member.gender === 'Male' ? 'M' : 'F';
      const memberPlans: InsurancePlan[] = [];

      Object.keys(INSURANCE_DB).forEach(provider => {
        const plans = INSURANCE_DB[provider];
        
        Object.keys(plans).forEach(planName => {
          // Location filtering
          const isNEPlan = planName.includes('_NE') || planName.startsWith('NE_') || planName.includes('NEMED');
          const isDubaiPlan = planName.includes('_DXB') || planName.includes('DMED') || planName.includes('EMED') || planName.includes('IMED') || planName.includes('DUBAI');
          
          if (isDubaiPlan && !isDubai) return;
          if (isNEPlan && isDubai) return;
          
          // Salary filtering for Orient basic plans
          if (provider === 'ORIENT') {
            const isLSB = planName.includes('_LSB');
            const isNLSB = planName.includes('_NLSB') || planName === 'IMED_DXB';
            
            if (member.sponsorship === 'Principal') {
              if (isBelowSalary && isNLSB) return;
              if (!isBelowSalary && isLSB) return;
            } else {
              // Dependents use DMED_LSB or DMED_NLSB
              if (planName.includes('EMED') || planName === 'IMED_DXB') return;
            }
          }

          const ageBand = findAgeBand(age, provider, planName);
          if (ageBand) {
            const rateData = plans[planName][ageBand];
            if (rateData && rateData[genderKey as 'M' | 'F']) {
              const premium = rateData[genderKey as 'M' | 'F'];
              
              let displayName = planName.replace(/_/g, ' ');
              let network = 'Standard';
              let copay = 'Variable';
              
              if (planName.includes('_0')) copay = '0% Copay';
              else if (planName.includes('_10')) copay = '10% Copay';
              else if (planName.includes('_20')) copay = '20% Copay';
              
              if (planName.includes('MEDNET')) network = 'MEDNET';
              else if (planName.includes('NAS')) network = 'NAS TPA';
              else if (planName.includes('NEXTCARE')) network = 'NEXTCARE';
              else if (provider === 'FIDELITY' && planName.includes('NE')) network = 'AAFIA TPA';
              else if (provider === 'UFIC') network = 'UFIC Network';
              else if (provider.includes('WATANIA')) network = 'NAS/Mednet TPA';
              else if (provider.includes('ORIENT')) network = 'Orient/Nextcare';
              else if (provider === 'TAKAFUL_EMARAT') network = 'NEXTCARE';
              
              const planId = `${provider}_${planName}`;
              
              // Create base plan
              let basePlan: InsurancePlan = {
                id: planId,
                provider: provider.replace(/_/g, ' '),
                plan: displayName,
                network,
                copay,
                premium,
                selected: false,
                status: 'none',
                benefits: getPlanBenefits(provider, planName, planId),
                planLocation: isDubaiPlan ? 'Dubai' : 'Northern Emirates',
                salaryCategory: planName.includes('_LSB') ? 'Below 4K' : planName.includes('_NLSB') ? 'Above 4K' : 'All'
              };
              
              // Apply any local edits
              basePlan = applyLocalEdits(basePlan);
              
              memberPlans.push(basePlan);
            }
          }
        });
      });

      // Add manual plans
      Object.keys(manualPlans).forEach(providerKey => {
        if (manualPlans[providerKey]) {
          manualPlans[providerKey].forEach(plan => {
            let manualPlan = { ...plan, selected: false, status: 'none' };
            manualPlan = applyLocalEdits(manualPlan);
            memberPlans.push(manualPlan);
          });
        }
      });

      memberPlans.sort((a, b) => a.premium - b.premium);

      newMemberResults[member.id] = {
        member,
        age,
        comparison: memberPlans,
        minPrice: memberPlans.length > 0 ? Math.min(...memberPlans.map(r => r.premium)) : 0,
        maxPrice: memberPlans.length > 0 ? Math.max(...memberPlans.map(r => r.premium)) : 0,
        avgPrice: memberPlans.length > 0 ? memberPlans.reduce((sum, r) => sum + r.premium, 0) / memberPlans.length : 0
      };
    });

    setMemberResults(newMemberResults);
    const initialExpanded: { [key: number]: boolean } = {};
    familyMembers.forEach(m => { initialExpanded[m.id] = true; });
    setExpandedMembers(initialExpanded);
  };

  // Toggle plan selection
  const togglePlanSelection = (memberId: number, planId: string) => {
    setMemberResults(prev => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        comparison: prev[memberId].comparison.map(item =>
          item.id === planId ? { ...item, selected: !item.selected } : item
        )
      }
    }));
  };

  // Update plan status
  const updatePlanStatus = (memberId: number, planId: string, status: string) => {
    setMemberResults(prev => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        comparison: prev[memberId].comparison.map(item =>
          item.id === planId ? { ...item, status: status as 'none' | 'renewal' | 'recommended' } : item
        )
      }
    }));
  };

  // Copy selected plans to other members
  const copyPlansToOthers = (sourceMemberId: number) => {
    const sourceResult = memberResults[sourceMemberId];
    if (!sourceResult) return;
    
    const selectedPlanIds = sourceResult.comparison.filter(p => p.selected).map(p => p.id);
    const selectedStatuses: { [key: string]: string } = {};
    sourceResult.comparison.filter(p => p.selected).forEach(p => {
      selectedStatuses[p.id] = p.status;
    });
    
    if (selectedPlanIds.length === 0) {
      alert('No plans selected to copy');
      return;
    }
    
    setMemberResults(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        const memberId = parseInt(key);
        if (memberId !== sourceMemberId) {
          updated[memberId] = {
            ...updated[memberId],
            comparison: updated[memberId].comparison.map(plan => ({
              ...plan,
              selected: selectedPlanIds.includes(plan.id) ? true : plan.selected,
              status: selectedPlanIds.includes(plan.id) ? (selectedStatuses[plan.id] as 'none' | 'renewal' | 'recommended') : plan.status
            }))
          };
        }
      });
      return updated;
    });
    
    alert(`✅ Copied ${selectedPlanIds.length} plans to ${Object.keys(memberResults).length - 1} other members`);
  };

  // Open edit result plan modal
  const openEditResultPlanModal = (memberId: number, planId: string) => {
    const plan = memberResults[memberId].comparison.find((p: any) => p.id === planId);
    if (!plan) return;
    setEditingResultPlan({ ...plan, memberId });
    setShowEditResultPlanModal(true);
  };

  // Save edited result plan
  const saveEditedResultPlan = () => {
    if (!editingResultPlan || !editingResultPlan.plan || !editingResultPlan.premium) {
      alert('Please enter plan name and premium');
      return;
    }
    
    const planId = editingResultPlan.id;
    const editData = {
      plan: editingResultPlan.plan,
      network: editingResultPlan.network || 'Standard',
      copay: editingResultPlan.copay || 'Variable',
      premium: parseFloat(editingResultPlan.premium)
    };

    // Save to localStorage for persistence
    setLocalPlanEdits(prev => ({
      ...prev,
      [planId]: editData
    }));

    // Update current session state for ALL members with this plan
    setMemberResults(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        const memberId = parseInt(key);
        updated[memberId] = {
          ...updated[memberId],
          comparison: updated[memberId].comparison.map((item: any) =>
            item.id === planId ? {
              ...item,
              plan: editData.plan,
              network: editData.network,
              copay: editData.copay,
              premium: editData.premium
            } : item
          )
        };
      });
      return updated;
    });

    setShowEditResultPlanModal(false);
    setEditingResultPlan(null);
    alert('✅ Plan updated and saved! Changes will persist after refresh.');
  };

  // Toggle benefits panel
  const toggleBenefitsPanel = (memberId: number, planId: string) => {
    const key = `${memberId}_${planId}`;
    const newShowState = !showBenefits[key];
    setShowBenefits(prev => ({ ...prev, [key]: newShowState }));
    if (newShowState) {
      const plan = memberResults[memberId].comparison.find(p => p.id === planId);
      if (plan) {
        // Use local edits if available, otherwise use plan benefits
        const existingBenefits = localBenefitsEdits[planId] || plan.benefits;
        // Ensure all new fields have defaults
        const benefitsToEdit = {
          ...defaultBenefits,
          ...existingBenefits,
          // Ensure complex objects are properly initialized
          dental: existingBenefits.dental || defaultBenefits.dental,
          optical: existingBenefits.optical || defaultBenefits.optical,
          alternativeMedicine: existingBenefits.alternativeMedicine || defaultBenefits.alternativeMedicine,
          preexisting: existingBenefits.preexisting || defaultBenefits.preexisting
        };
        setEditingBenefits(prev => ({ ...prev, [key]: benefitsToEdit }));
      }
    }
  };

  // Update benefits - NOW SAVES TO LOCALSTORAGE FOR PERSISTENCE
  const updateBenefits = async (memberId: number, planId: string) => {
    const key = `${memberId}_${planId}`;
    const updatedBenefits = editingBenefits[key];
    if (!updatedBenefits) return;
    
    // Save to localStorage for persistence
    setLocalBenefitsEdits(prev => ({
      ...prev,
      [planId]: updatedBenefits
    }));

    // Update current session state for ALL members with this plan
    setMemberResults(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(mKey => {
        const mId = parseInt(mKey);
        updated[mId] = {
          ...updated[mId],
          comparison: updated[mId].comparison.map(item =>
            item.id === planId ? { ...item, benefits: { ...updatedBenefits } } : item
          )
        };
      });
      return updated;
    });
    
    // Also try to save to cloud
    try {
      await fetch('/api/benefits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey: planId, benefits: updatedBenefits })
      });
      setCloudBenefits(prev => ({ ...prev, [planId]: updatedBenefits }));
      alert('✅ Benefits saved! Changes will persist after refresh.');
    } catch (error) {
      console.error('Error saving benefits to cloud:', error);
      alert('✅ Benefits saved locally! Cloud sync may be unavailable.');
    }
    
    setShowBenefits(prev => ({ ...prev, [key]: false }));
  };

  // Clear all local edits
  const clearAllLocalEdits = () => {
    if (window.confirm('Clear all saved plan and benefit edits? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEYS.PLAN_EDITS);
      localStorage.removeItem(STORAGE_KEYS.BENEFITS_EDITS);
      setLocalPlanEdits({});
      setLocalBenefitsEdits({});
      alert('All local edits cleared. Please search again to see original data.');
    }
  };

  // Save to report history
  const saveToReportHistory = (reportName: string) => {
    const reportState = {
      id: Date.now(),
      name: reportName,
      timestamp: new Date().toISOString(),
      familyMembers,
      sharedSettings,
      memberResults,
      advisorComment,
      manualPlans
    };
    const history = [...reportHistory, reportState];
    localStorage.setItem(STORAGE_KEYS.REPORT_HISTORY, JSON.stringify(history));
    setReportHistory(history);
  };

  // Load from history
  const loadReportFromHistory = (reportId: number) => {
    const report = reportHistory.find(r => r.id === reportId);
    if (!report) return;
    setFamilyMembers(report.familyMembers);
    setSharedSettings(report.sharedSettings);
    setMemberResults(report.memberResults);
    setAdvisorComment(report.advisorComment);
    setManualPlans(report.manualPlans || {});
    const initialExpanded: { [key: number]: boolean } = {};
    report.familyMembers.forEach((m: FamilyMember) => { initialExpanded[m.id] = true; });
    setExpandedMembers(initialExpanded);
    setShowReportHistory(false);
  };

  // Delete from history
  const deleteReportFromHistory = (reportId: number) => {
    if (!window.confirm('Delete this report from history?')) return;
    const history = reportHistory.filter(r => r.id !== reportId);
    localStorage.setItem(STORAGE_KEYS.REPORT_HISTORY, JSON.stringify(history));
    setReportHistory(history);
  };

  // Filter plans based on search
  const filterPlans = (plans: InsurancePlan[]): InsurancePlan[] => {
    return plans.filter(plan => {
      const providerMatch = !providerSearch || 
        plan.provider.toLowerCase().includes(providerSearch.toLowerCase());
      const planMatch = !planSearch || 
        plan.plan.toLowerCase().includes(planSearch.toLowerCase());
      const networkMatch = !networkSearch || 
        plan.network.toLowerCase().includes(networkSearch.toLowerCase());
      return providerMatch && planMatch && networkMatch;
    });
  };

  // Get unique providers for suggestions
  const getUniqueProviders = (): string[] => {
    const providers = new Set<string>();
    Object.keys(memberResults).forEach(key => {
      memberResults[parseInt(key)].comparison.forEach(plan => {
        providers.add(plan.provider);
      });
    });
    return Array.from(providers).sort();
  };

  // Get unique plans for suggestions
  const getUniquePlans = (): string[] => {
    const plans = new Set<string>();
    Object.keys(memberResults).forEach(key => {
      memberResults[parseInt(key)].comparison.forEach(plan => {
        plans.add(plan.plan);
      });
    });
    return Array.from(plans).sort();
  };

  // Get unique networks for suggestions
  const getUniqueNetworks = (): string[] => {
    const networks = new Set<string>();
    Object.keys(memberResults).forEach(key => {
      memberResults[parseInt(key)].comparison.forEach(plan => {
        networks.add(plan.network);
      });
    });
    return Array.from(networks).sort();
  };

  // ============================================================================
  // GENERATE PDF REPORT - CONSOLIDATED VIEW
  // ============================================================================
  const generateReport = async () => {
    if (Object.keys(memberResults).length === 0) return;
    
    let hasSelectedPlans = false;
    Object.keys(memberResults).forEach(memberId => {
      const selectedCount = memberResults[parseInt(memberId)].comparison.filter(p => p.selected).length;
      if (selectedCount > 0) hasSelectedPlans = true;
    });
    
    if (!hasSelectedPlans) {
      alert('Please select at least one plan for at least one member');
      return;
    }

    setIsGenerating(true);
    const today = new Date().toLocaleDateString('en-GB');
    const clientName = familyMembers[0]?.name || 'Family';
    const fileName = `NSIB_Report_${clientName}_${today.replace(/\//g, '-')}`;
    saveToReportHistory(fileName);

    // CONSOLIDATED VIEW - ONE TABLE FOR ALL MEMBERS
    // Get all unique selected plan IDs across all members
    const allSelectedPlanIds = new Set<string>();
    const allMembersWithSelections: { member: FamilyMember; age: number }[] = [];
    
    familyMembers.forEach(member => {
      const results = memberResults[member.id];
      if (!results) return;
      
      const selectedPlans = results.comparison.filter(p => p.selected);
      if (selectedPlans.length > 0) {
        allMembersWithSelections.push({ member, age: results.age });
        selectedPlans.forEach(p => allSelectedPlanIds.add(p.id));
      }
    });

    if (allMembersWithSelections.length === 0) {
      setIsGenerating(false);
      return;
    }

    // Get the plan details from the first member (benefits are same for all)
    const firstMemberResults = memberResults[allMembersWithSelections[0].member.id];
    const selectedPlans = Array.from(allSelectedPlanIds).map(planId => 
      firstMemberResults.comparison.find(p => p.id === planId)
    ).filter(Boolean) as InsurancePlan[];
    
    // Sort by premium (lowest first)
    selectedPlans.sort((a, b) => a.premium - b.premium);

    const numPlans = selectedPlans.length;
    const numMembers = allMembersWithSelections.length;

    // Calculate totals per plan (sum across all members)
    const planTotals: { [planId: string]: number } = {};
    selectedPlans.forEach(plan => {
      planTotals[plan.id] = 0;
      allMembersWithSelections.forEach(m => {
        const memberResult = memberResults[m.member.id];
        const memberPlan = memberResult?.comparison.find(p => p.id === plan.id);
        if (memberPlan) planTotals[plan.id] += memberPlan.premium;
      });
    });

    // Dynamic column width based on number of plans
    const planColWidth = numPlans <= 2 ? 220 : numPlans <= 3 ? 180 : numPlans <= 4 ? 150 : numPlans <= 5 ? 130 : 110;
    
    // Build subtitle based on number of members
    const subtitleText = numMembers === 1 
      ? `${allMembersWithSelections[0].member.name || allMembersWithSelections[0].member.relationship} | Age: ${allMembersWithSelections[0].age} | ${allMembersWithSelections[0].member.gender} | ${allMembersWithSelections[0].member.sponsorship}`
      : `${numMembers} Members: ${allMembersWithSelections.map(m => `${m.member.name || m.member.relationship} (${m.age}y)`).join(', ')}`;

    // Generate ONE consolidated table
    const consolidatedTable = `
<div class="page-wrapper">
  <div class="page-content">
    <div class="header-row">
      <img src="https://i.imgur.com/ZU7bP7o.png" alt="NSIB" class="logo" />
      <div class="title-block">
        <h1>MEDICAL INSURANCE COMPARISON</h1>
        <h2>${subtitleText}</h2>
      </div>
      <img src="https://i.imgur.com/Wsv3Ah2.png" alt="Mascot" class="mascot" />
    </div>

    <div class="info-bar">
      <span><b>Emirate:</b> ${sharedSettings.location}</span>
      <span><b>Salary:</b> ${sharedSettings.salaryCategory === 'below4000' ? 'Below 4,000 AED' : 'Above 4,000 AED'}</span>
      <span><b>Date:</b> ${today}</span>
    </div>

    <table class="main-table" style="table-layout:fixed;">
      <colgroup>
        <col style="width:140px;">
        ${selectedPlans.map(() => `<col style="width:${planColWidth}px;">`).join('')}
      </colgroup>
      <thead>
        <tr>
          <th class="col-benefit">BENEFITS</th>
          ${selectedPlans.map(plan => `
            <th class="col-plan">
              ${plan.provider}
              ${plan.status === 'renewal' ? '<div class="tag tag-renewal">RENEWAL</div>' : ''}
              ${plan.status === 'recommended' ? '<div class="tag tag-recommended">RECOMMENDED</div>' : ''}
            </th>
          `).join('')}
        </tr>
      </thead>
      <tbody>
        <tr><td class="cell-label">Plan Name</td>${selectedPlans.map(p => `<td class="cell-value">${p.plan}</td>`).join('')}</tr>
        <tr class="row-alt"><td class="cell-label">Area of Cover</td>${selectedPlans.map(p => `<td class="cell-value">${p.benefits.areaOfCover || '-'}</td>`).join('')}</tr>
        <tr><td class="cell-label">Annual Limit</td>${selectedPlans.map(p => `<td class="cell-value">${p.benefits.annualLimit || '-'}</td>`).join('')}</tr>
        <tr class="row-alt"><td class="cell-label">Network</td>${selectedPlans.map(p => `<td class="cell-value">${p.benefits.network || p.network || '-'}</td>`).join('')}</tr>
        <tr><td class="cell-label">Consultation Deductible</td>${selectedPlans.map(p => `<td class="cell-detail">${p.benefits.consultationDeductible || '-'}</td>`).join('')}</tr>
        <tr class="row-alt"><td class="cell-label">Prescribed Drugs & Medicines</td>${selectedPlans.map(p => `<td class="cell-detail">${p.benefits.prescribedDrugs || '-'}</td>`).join('')}</tr>
        <tr><td class="cell-label">Diagnostics</td>${selectedPlans.map(p => `<td class="cell-detail">${p.benefits.diagnostics || '-'}</td>`).join('')}</tr>
        <tr class="row-alt"><td class="cell-label">Pre-existing Condition</td>${selectedPlans.map(p => `<td class="cell-detail">${p.benefits.preexistingCondition || '-'}</td>`).join('')}</tr>
        <tr><td class="cell-label">Physiotherapy</td>${selectedPlans.map(p => `<td class="cell-detail">${p.benefits.physiotherapy || '-'}</td>`).join('')}</tr>
        <tr class="row-alt"><td class="cell-label">Out-patient Maternity</td>${selectedPlans.map(p => `<td class="cell-detail">${p.benefits.outpatientMaternity || '-'}</td>`).join('')}</tr>
        <tr><td class="cell-label">In-patient Maternity</td>${selectedPlans.map(p => `<td class="cell-detail">${p.benefits.inpatientMaternity || '-'}</td>`).join('')}</tr>
        <tr class="row-alt"><td class="cell-label">Dental</td>${selectedPlans.map(p => `<td class="cell-detail">${p.benefits.dental?.enabled ? (p.benefits.dental.value || 'Covered') : 'Not Covered'}</td>`).join('')}</tr>
        <tr><td class="cell-label">Optical</td>${selectedPlans.map(p => `<td class="cell-detail">${p.benefits.optical?.enabled ? (p.benefits.optical.value || 'Covered') : 'Not Covered'}</td>`).join('')}</tr>
        <tr class="row-alt"><td class="cell-label">Alternative Medicine</td>${selectedPlans.map(p => `<td class="cell-detail">${p.benefits.alternativeMedicine?.enabled ? (p.benefits.alternativeMedicine.value || 'Covered') : 'Not Covered'}</td>`).join('')}</tr>
        ${allMembersWithSelections.map((m, idx) => `
          <tr class="row-member">
            <td class="cell-label">${m.member.name || m.member.relationship} (${m.age}y)</td>
            ${selectedPlans.map(plan => {
              const memberResult = memberResults[m.member.id];
              const memberPlan = memberResult?.comparison.find(p => p.id === plan.id);
              return `<td class="cell-premium">${memberPlan ? memberPlan.premium.toLocaleString('en-AE', { minimumFractionDigits: 2 }) : '-'}</td>`;
            }).join('')}
          </tr>
        `).join('')}
        <tr class="row-total">
          <td class="cell-total-label">${numMembers > 1 ? 'TOTAL Premium (AED)' : 'Annual Premium (AED)'}</td>
          ${selectedPlans.map(plan => `<td class="cell-total-value">${planTotals[plan.id].toLocaleString('en-AE', { minimumFractionDigits: 2 })}</td>`).join('')}
        </tr>
      </tbody>
    </table>

    ${advisorComment ? `
    <div class="advisor-box">
      <b>Advisor Comment:</b> ${advisorComment}
    </div>
    ` : ''}

    <div class="disclaimer-box">
      <b>Disclaimer:</b> While we make every effort to ensure the accuracy and timeliness of the details provided in the comparison table, there may be instances where the actual coverage differs. In such cases, the terms outlined in the insurer's official policy wording and schedule will take precedence over the information provided by us.
    </div>
  </div>

  <div class="page-footer">
    <div class="footer-left">
      Suite 2801, One by Omniyat, Al Mustaqbal Street, Business Bay, Dubai, U.A.E<br>
      PO Box 233640 | <b>UAE Central Bank Registration Number: 200</b>
    </div>
    <div class="footer-right">
      Call us on: <b>047058000</b><br>
      Email us on: <b>enquiry@nsib.ae</b> | Visit us: <b>www.nsib.ae</b>
    </div>
  </div>
</div>
    `;

    const reportHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>NSIB Insurance Comparison - ${clientName}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 0;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html, body {
      width: 297mm;
      height: 210mm;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9px;
      line-height: 1.3;
      background: white;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    
    /* Cover Page */
    .cover-page {
      width: 297mm;
      height: 210mm;
      display: flex;
      align-items: center;
      justify-content: center;
      page-break-after: always;
      background: white;
    }
    .cover-page img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    
    /* Report Page */
    .page-wrapper {
      width: 297mm;
      height: 210mm;
      padding: 8mm;
      position: relative;
      background: white;
      page-break-after: always;
      page-break-inside: avoid;
      overflow: hidden;
    }
    
    .page-content {
      height: calc(210mm - 16mm - 45px);
      overflow: hidden;
    }
    
    /* Header */
    .header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
      padding-bottom: 6px;
      border-bottom: 2px solid #f97316;
    }
    .logo { height: 38px; }
    .mascot { height: 50px; }
    .title-block { text-align: center; flex: 1; padding: 0 15px; }
    .title-block h1 { font-size: 15px; color: #f97316; margin: 0 0 3px 0; font-weight: bold; }
    .title-block h2 { font-size: 11px; color: #374151; margin: 0; font-weight: normal; }
    
    /* Info Bar */
    .info-bar {
      display: flex;
      justify-content: center;
      gap: 30px;
      padding: 5px 0;
      margin-bottom: 6px;
      background: #f8fafc;
      border-radius: 4px;
      font-size: 9px;
    }
    .info-bar span { color: #374151; }
    .info-bar b { color: #1e40af; }
    
    /* Main Table */
    .main-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8px;
      margin-bottom: 6px;
    }
    .main-table th,
    .main-table td {
      border: 1px solid #d1d5db;
      padding: 4px 5px;
      text-align: center;
      vertical-align: middle;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .main-table th {
      background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
      color: white;
      font-weight: bold;
      font-size: 9px;
      padding: 6px 5px;
    }
    .col-benefit { text-align: left !important; background: #1e40af !important; }
    .col-plan { min-width: 100px; }
    
    .cell-label {
      text-align: left !important;
      font-weight: 600;
      color: #1f2937;
      background: #f8fafc;
    }
    .cell-value { 
      font-size: 8px; 
      text-align: center !important;
      vertical-align: middle !important;
    }
    .cell-detail { 
      font-size: 7px; 
      line-height: 1.2; 
      text-align: center !important;
      vertical-align: middle !important;
      padding: 3px 4px !important; 
    }
    .cell-small { 
      font-size: 6.5px; 
      line-height: 1.15; 
      text-align: center !important;
      vertical-align: middle !important;
    }
    .cell-premium { 
      font-weight: 600; 
      color: #059669; 
      font-size: 9px; 
      text-align: center !important;
      vertical-align: middle !important;
    }
    
    .row-alt { background: #fffbeb; }
    .row-alt .cell-label { background: #fef3c7; }
    
    .row-member { background: #f0fdf4; }
    .row-member .cell-label { background: #dcfce7; }
    
    .row-total { background: #dbeafe; }
    .cell-total-label {
      text-align: left !important;
      font-weight: bold;
      color: #1e40af;
      background: #bfdbfe !important;
      font-size: 9px;
    }
    .cell-total-value {
      font-weight: bold;
      color: #1d4ed8;
      font-size: 11px;
      background: #dbeafe;
      text-align: center !important;
      vertical-align: middle !important;
    }
    
    /* Tags */
    .tag {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 8px;
      font-size: 6px;
      font-weight: bold;
      margin-top: 2px;
    }
    .tag-renewal { background: #fbbf24; color: #78350f; }
    .tag-recommended { background: #22c55e; color: white; }
    
    /* Advisor & Disclaimer */
    .advisor-box {
      background: #e0f2fe;
      border-left: 3px solid #2563eb;
      padding: 5px 8px;
      margin-bottom: 5px;
      font-size: 8px;
      color: #1e3a8a;
    }
    .disclaimer-box {
      background: #fef3c7;
      border-left: 3px solid #f59e0b;
      padding: 4px 8px;
      font-size: 7px;
      color: #78350f;
    }
    
    /* Footer */
    .page-footer {
      position: absolute;
      bottom: 8mm;
      left: 8mm;
      right: 8mm;
      display: flex;
      justify-content: space-between;
      background: linear-gradient(90deg, #fff7ed 0%, #ffedd5 100%);
      padding: 8px 12px;
      border-radius: 5px;
      font-size: 8px;
      color: #78350f;
    }
    .footer-left { text-align: left; }
    .footer-right { text-align: right; }
    .page-footer b { color: #ea580c; }
    
    /* Print Specific */
    @media print {
      html, body {
        width: 297mm;
        height: 210mm;
      }
      .page-wrapper {
        page-break-after: always;
        page-break-inside: avoid;
      }
      .cover-page {
        page-break-after: always;
      }
    }
  </style>
</head>
<body>
<div class="cover-page">
  <img src="https://i.imgur.com/oIjCU2a.png" alt="NSIB Cover" />
</div>
${consolidatedTable}
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(reportHTML);
      printWindow.document.close();
    }

    // Upload to cloud
    try {
      await fetch('/api/upload-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ htmlContent: reportHTML, fileName, metadata: { clientName, location: sharedSettings.location } })
      });
    } catch (e) { console.error('Cloud upload failed:', e); }
    
    setIsGenerating(false);
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 p-4">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-orange-600 mb-2">🏥 NSIB Insurance Comparison Tool</h1>
          <p className="text-gray-600">Compare health insurance plans for individuals and families</p>
        </div>

        {/* Family Members */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">👨‍👩‍👧‍👦 Family Members ({familyMembers.length})</h2>
            <button onClick={addFamilyMember} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg">➕ Add Member</button>
          </div>
          
          <div className="space-y-4">
            {familyMembers.map((member, idx) => {
              const age = member.dob ? calculateAge(member.dob) : null;
              return (
                <div key={member.id} className="p-4 border-2 border-orange-200 rounded-lg bg-orange-50">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-orange-800">
                      Member {idx + 1} {age !== null && `(Age: ${age})`}
                    </h3>
                    {familyMembers.length > 1 && (
                      <button onClick={() => removeFamilyMember(member.id)} className="text-red-600 hover:text-red-800">🗑️</button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    <input type="text" placeholder="Name" value={member.name} onChange={(e) => updateFamilyMember(member.id, 'name', e.target.value)} className="px-3 py-2 border rounded-lg" />
                    <input type="date" value={member.dob} onChange={(e) => updateFamilyMember(member.id, 'dob', e.target.value)} className="px-3 py-2 border rounded-lg" />
                    <select value={member.gender} onChange={(e) => updateFamilyMember(member.id, 'gender', e.target.value)} className="px-3 py-2 border rounded-lg">
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                    <select value={member.sponsorship} onChange={(e) => updateFamilyMember(member.id, 'sponsorship', e.target.value)} className="px-3 py-2 border rounded-lg">
                      <option value="Principal">Principal</option>
                      <option value="Husband">Husband</option>
                      <option value="Wife">Wife</option>
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Dependent">Dependent</option>
                    </select>
                    <select value={member.relationship} onChange={(e) => updateFamilyMember(member.id, 'relationship', e.target.value)} className="px-3 py-2 border rounded-lg">
                      <option value="Self">Self</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Child">Child</option>
                      <option value="Son">Son</option>
                      <option value="Daughter">Daughter</option>
                      <option value="Parent">Parent</option>
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Dependent">Dependent</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Settings */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-3">⚙️ Search Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <select value={sharedSettings.location} onChange={(e) => setSharedSettings({ ...sharedSettings, location: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="Dubai">Dubai</option>
                  <option value="Northern Emirates">Northern Emirates</option>
                </select>
              </div>
              {familyMembers.some(m => m.sponsorship === 'Principal') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Salary (Principal)</label>
                  <select value={sharedSettings.salaryCategory} onChange={(e) => setSharedSettings({ ...sharedSettings, salaryCategory: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                    <option value="below4000">Below 4,000 AED</option>
                    <option value="above4000">Above 4,000 AED</option>
                  </select>
                </div>
              )}
              <div className="flex items-end">
                <button onClick={searchPlans} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-6 rounded-lg">🔍 Search Plans</button>
              </div>
            </div>
            
            {/* Show local edits info */}
            {(Object.keys(localPlanEdits).length > 0 || Object.keys(localBenefitsEdits).length > 0) && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg flex justify-between items-center border border-green-200">
                <span className="text-sm text-green-700">
                  💾 {Object.keys(localPlanEdits).length} plan edits and {Object.keys(localBenefitsEdits).length} benefits edits saved locally
                </span>
                <button onClick={clearAllLocalEdits} className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm">
                  Clear All Edits
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Manual Plan Entry */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">✍️ Manual Plan Entry</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {MANUAL_PROVIDERS.map(provider => (
              <button key={provider.id} onClick={() => { setCurrentProvider(provider.id); setShowManualPlanModal(true); }} className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium">➕ {provider.name}</button>
            ))}
          </div>
          {/* Show count of manual plans saved */}
          {Object.keys(manualPlans).some(key => manualPlans[key]?.length > 0) && (
            <div className="mt-3 p-2 bg-green-50 rounded-lg border border-green-200 text-sm text-green-700">
              💾 {Object.values(manualPlans).flat().length} manual plan(s) saved. Click "Search Plans" to see them in results.
            </div>
          )}
        </div>

        {/* Manual Plan Modal */}
        {showManualPlanModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full m-4">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Add {MANUAL_PROVIDERS.find(p => p.id === currentProvider)?.name} Plan</h3>
              <div className="space-y-4">
                <input type="text" placeholder="Plan Name *" value={newManualPlan.planName} onChange={(e) => setNewManualPlan({ ...newManualPlan, planName: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
                <select value={newManualPlan.network} onChange={(e) => setNewManualPlan({ ...newManualPlan, network: e.target.value })} className="w-full px-4 py-2 border rounded-lg">
                  <option value="">Select Network</option>
                  {MANUAL_PROVIDERS.find(p => p.id === currentProvider)?.networks.map(network => (
                    <option key={network} value={network}>{network}</option>
                  ))}
                </select>
                <input type="text" placeholder="Copay (e.g., 0%, 20%)" value={newManualPlan.copay} onChange={(e) => setNewManualPlan({ ...newManualPlan, copay: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
                <input type="number" placeholder="Annual Premium (AED) *" value={newManualPlan.premium} onChange={(e) => setNewManualPlan({ ...newManualPlan, premium: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowManualPlanModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={addManualPlan} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Add Plan</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Plan Modal */}
        {showEditResultPlanModal && editingResultPlan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full m-4">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Plan</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name</label>
                  <input type="text" value={editingResultPlan.plan} onChange={(e) => setEditingResultPlan({ ...editingResultPlan, plan: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Network</label>
                  <input type="text" value={editingResultPlan.network} onChange={(e) => setEditingResultPlan({ ...editingResultPlan, network: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Copay</label>
                  <input type="text" value={editingResultPlan.copay} onChange={(e) => setEditingResultPlan({ ...editingResultPlan, copay: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Premium (AED)</label>
                  <input type="number" value={editingResultPlan.premium} onChange={(e) => setEditingResultPlan({ ...editingResultPlan, premium: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => { setShowEditResultPlanModal(false); setEditingResultPlan(null); }} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={saveEditedResultPlan} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg">Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {Object.keys(memberResults).length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
              <h2 className="text-xl font-bold text-gray-800">📊 Comparison Results</h2>
              <div className="flex gap-3">
                <button onClick={() => setShowReportHistory(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg">📁 History ({reportHistory.length})</button>
                <button onClick={generateReport} disabled={isGenerating} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50">{isGenerating ? '⏳ Generating...' : '📄 Generate PDF'}</button>
              </div>
            </div>

            <div className="flex gap-4 mb-4 p-3 bg-blue-50 rounded-lg text-sm">
              <span><strong>📍</strong> {sharedSettings.location}</span>
              <span><strong>💰</strong> {sharedSettings.salaryCategory === 'below4000' ? 'Below 4K' : 'Above 4K'}</span>
              <span><strong>👥</strong> {familyMembers.length} members</span>
            </div>

            {/* SEARCH FILTERS FOR PROVIDER, PLAN AND NETWORK */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg border">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🏢 Provider</label>
                <input
                  type="text"
                  value={providerSearch}
                  onChange={(e) => setProviderSearch(e.target.value)}
                  placeholder="Filter by provider..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  list="provider-suggestions"
                />
                <datalist id="provider-suggestions">
                  {getUniqueProviders().map(p => <option key={p} value={p} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">📋 Plan</label>
                <input
                  type="text"
                  value={planSearch}
                  onChange={(e) => setPlanSearch(e.target.value)}
                  placeholder="Filter by plan name..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  list="plan-suggestions"
                />
                <datalist id="plan-suggestions">
                  {getUniquePlans().map(p => <option key={p} value={p} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🌐 Network</label>
                <input
                  type="text"
                  value={networkSearch}
                  onChange={(e) => setNetworkSearch(e.target.value)}
                  placeholder="Filter by network..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  list="network-suggestions"
                />
                <datalist id="network-suggestions">
                  {getUniqueNetworks().map(n => <option key={n} value={n} />)}
                </datalist>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => { setProviderSearch(''); setPlanSearch(''); setNetworkSearch(''); }}
                  className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">💬 Advisor Comment</label>
              <textarea value={advisorComment} onChange={(e) => setAdvisorComment(e.target.value)} placeholder="Notes for client..." className="w-full px-4 py-2 border rounded-lg resize-y min-h-[60px]" />
            </div>

            {/* Member Results */}
            {familyMembers.map((member, memberIdx) => {
              const results = memberResults[member.id];
              if (!results) return null;
              const filteredPlans = filterPlans(results.comparison);
              const selectedCount = results.comparison.filter(p => p.selected).length;
              const displayPlans = showSelected[member.id] ? filteredPlans.filter(p => p.selected) : filteredPlans;
              
              return (
                <div key={member.id} className="mb-6 border-2 border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-orange-100 to-blue-100 cursor-pointer" onClick={() => setExpandedMembers(prev => ({ ...prev, [member.id]: !prev[member.id] }))}>
                    <div>
                      <h3 className="font-bold text-gray-800">{member.name || `Member ${memberIdx + 1}`} ({member.relationship})</h3>
                      <p className="text-sm text-gray-600">Age: {results.age} | {member.gender} | {member.sponsorship}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-blue-600">{filteredPlans.length} plans</span>
                      <span className="text-sm font-medium text-green-600">{selectedCount} selected</span>
                      <span className="text-2xl">{expandedMembers[member.id] ? '▼' : '▶'}</span>
                    </div>
                  </div>

                  {expandedMembers[member.id] && (
                    <div className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="p-3 bg-green-50 rounded-lg text-center">
                          <p className="text-xs text-gray-600">Lowest</p>
                          <p className="font-bold text-green-700">AED {results.minPrice.toLocaleString()}</p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg text-center">
                          <p className="text-xs text-gray-600">Average</p>
                          <p className="font-bold text-blue-700">AED {Math.round(results.avgPrice).toLocaleString()}</p>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg text-center">
                          <p className="text-xs text-gray-600">Showing</p>
                          <p className="font-bold text-purple-700">{filteredPlans.length} / {results.comparison.length}</p>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-lg text-center">
                          <p className="text-xs text-gray-600">Selected</p>
                          <p className="font-bold text-orange-700">{selectedCount}</p>
                        </div>
                      </div>

                      <div className="flex gap-3 mb-4">
                        <button onClick={() => setShowSelected(prev => ({ ...prev, [member.id]: !prev[member.id] }))} className={`px-4 py-2 rounded-lg text-sm font-medium ${showSelected[member.id] ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                          {showSelected[member.id] ? '✓ Selected Only' : 'Show All'}
                        </button>
                        {selectedCount > 0 && Object.keys(memberResults).length > 1 && (
                          <button onClick={() => copyPlansToOthers(member.id)} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium">
                            📋 Copy to Other Members
                          </button>
                        )}
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="p-2 text-left w-10">✓</th>
                              <th className="p-2 text-left w-10">#</th>
                              <th className="p-2 text-left">Provider</th>
                              <th className="p-2 text-left">Plan</th>
                              <th className="p-2 text-left">Network</th>
                              <th className="p-2 text-left">Copay</th>
                              <th className="p-2 text-right">Premium</th>
                              <th className="p-2 text-center">Status</th>
                              <th className="p-2 text-center">Edit</th>
                              <th className="p-2 text-center">Benefits</th>
                              <th className="p-2 text-center w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayPlans.map((plan, planIdx) => {
                              const actualRank = results.comparison.findIndex(p => p.id === plan.id) + 1;
                              const benefitsKey = `${member.id}_${plan.id}`;
                              const hasLocalEdits = localPlanEdits[plan.id] || localBenefitsEdits[plan.id];
                              
                              return (
                                <React.Fragment key={plan.id}>
                                  <tr className={`border-b hover:bg-gray-50 ${plan.selected ? 'bg-green-50' : ''} ${hasLocalEdits ? 'border-l-4 border-l-blue-500' : ''} ${plan.isManual ? 'border-l-4 border-l-purple-500' : ''}`}>
                                    <td className="p-2"><input type="checkbox" checked={plan.selected} onChange={() => togglePlanSelection(member.id, plan.id)} className="w-4 h-4" /></td>
                                    <td className="p-2">
                                      {actualRank <= 3 ? (
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${actualRank === 1 ? 'bg-yellow-400 text-yellow-800' : actualRank === 2 ? 'bg-gray-300 text-gray-700' : 'bg-orange-300 text-orange-800'}`}>#{actualRank}</span>
                                      ) : actualRank}
                                    </td>
                                    <td className="p-2 font-medium">
                                      {plan.provider}
                                      {plan.isManual && <span className="ml-1 px-1 py-0.5 bg-purple-100 text-purple-600 text-xs rounded">Manual</span>}
                                    </td>
                                    <td className="p-2">
                                      {plan.plan}
                                      {hasLocalEdits && <span className="ml-1 text-blue-500 text-xs">✎</span>}
                                    </td>
                                    <td className="p-2">{plan.network}</td>
                                    <td className="p-2">{plan.copay}</td>
                                    <td className="p-2 text-right font-semibold text-blue-700">AED {plan.premium.toLocaleString()}</td>
                                    <td className="p-2 text-center">
                                      <select value={plan.status} onChange={(e) => updatePlanStatus(member.id, plan.id, e.target.value)} className="text-xs px-2 py-1 border rounded">
                                        <option value="none">-</option>
                                        <option value="renewal">Renewal</option>
                                        <option value="recommended">Recommended</option>
                                      </select>
                                    </td>
                                    <td className="p-2 text-center"><button onClick={() => openEditResultPlanModal(member.id, plan.id)} className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded">✏️</button></td>
                                    <td className="p-2 text-center"><button onClick={() => toggleBenefitsPanel(member.id, plan.id)} className={`px-2 py-1 text-xs rounded ${showBenefits[benefitsKey] ? 'bg-orange-500 text-white' : 'bg-orange-100 hover:bg-orange-200'}`}>{showBenefits[benefitsKey] ? '▲' : '⚙️'}</button></td>
                                    <td className="p-2 text-center">
                                      {plan.isManual && (
                                        <button onClick={() => deleteManualPlan(plan.providerKey || '', plan.id)} className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-600 rounded">🗑️</button>
                                      )}
                                    </td>
                                  </tr>
                                  
                                  {showBenefits[benefitsKey] && editingBenefits[benefitsKey] && (
                                    <tr>
                                      <td colSpan={11} className="p-0">
                                        <div className="p-4 bg-gray-50 border-t">
                                          <h4 className="font-bold text-gray-800 mb-3">📋 Benefits Configuration</h4>
                                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {/* 1. Area of Cover */}
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">Area of Cover</label>
                                              <input type="text" value={editingBenefits[benefitsKey].areaOfCover || ''} onChange={(e) => setEditingBenefits(prev => ({ ...prev, [benefitsKey]: { ...prev[benefitsKey], areaOfCover: e.target.value } }))} className="w-full px-3 py-2 border rounded text-sm" placeholder="e.g., UAE, Worldwide..." />
                                            </div>
                                            {/* 2. Annual Limit */}
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">Annual Limit</label>
                                              <input type="text" value={editingBenefits[benefitsKey].annualLimit || ''} onChange={(e) => setEditingBenefits(prev => ({ ...prev, [benefitsKey]: { ...prev[benefitsKey], annualLimit: e.target.value } }))} className="w-full px-3 py-2 border rounded text-sm" placeholder="e.g., AED 150,000..." />
                                            </div>
                                            {/* 3. Network */}
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">Network</label>
                                              <input type="text" value={editingBenefits[benefitsKey].network || ''} onChange={(e) => setEditingBenefits(prev => ({ ...prev, [benefitsKey]: { ...prev[benefitsKey], network: e.target.value } }))} className="w-full px-3 py-2 border rounded text-sm" placeholder="e.g., PCPC, RN3..." />
                                            </div>
                                            {/* 4. Consultation Deductible */}
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">Consultation Deductible</label>
                                              <input type="text" value={editingBenefits[benefitsKey].consultationDeductible || ''} onChange={(e) => setEditingBenefits(prev => ({ ...prev, [benefitsKey]: { ...prev[benefitsKey], consultationDeductible: e.target.value } }))} className="w-full px-3 py-2 border rounded text-sm" placeholder="e.g., AED 50 per visit..." />
                                            </div>
                                            {/* 5. Prescribed Drugs & Medicines */}
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">Prescribed Drugs & Medicines</label>
                                              <input type="text" value={editingBenefits[benefitsKey].prescribedDrugs || ''} onChange={(e) => setEditingBenefits(prev => ({ ...prev, [benefitsKey]: { ...prev[benefitsKey], prescribedDrugs: e.target.value } }))} className="w-full px-3 py-2 border rounded text-sm" placeholder="e.g., Up to AED 2,000/year..." />
                                            </div>
                                            {/* 6. Diagnostics */}
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">Diagnostics</label>
                                              <input type="text" value={editingBenefits[benefitsKey].diagnostics || ''} onChange={(e) => setEditingBenefits(prev => ({ ...prev, [benefitsKey]: { ...prev[benefitsKey], diagnostics: e.target.value } }))} className="w-full px-3 py-2 border rounded text-sm" placeholder="e.g., Covered with 20% coinsurance..." />
                                            </div>
                                            {/* 7. Pre-existing Condition */}
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">Pre-existing Condition</label>
                                              <input type="text" value={editingBenefits[benefitsKey].preexistingCondition || ''} onChange={(e) => setEditingBenefits(prev => ({ ...prev, [benefitsKey]: { ...prev[benefitsKey], preexistingCondition: e.target.value } }))} className="w-full px-3 py-2 border rounded text-sm" placeholder="e.g., 6 months exclusion, then covered..." />
                                            </div>
                                            {/* 8. Physiotherapy */}
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">Physiotherapy</label>
                                              <input type="text" value={editingBenefits[benefitsKey].physiotherapy || ''} onChange={(e) => setEditingBenefits(prev => ({ ...prev, [benefitsKey]: { ...prev[benefitsKey], physiotherapy: e.target.value } }))} className="w-full px-3 py-2 border rounded text-sm" placeholder="e.g., Up to 12 sessions per year..." />
                                            </div>
                                            {/* 9. Out-patient Maternity Services */}
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">Out-patient Maternity Services</label>
                                              <input type="text" value={editingBenefits[benefitsKey].outpatientMaternity || ''} onChange={(e) => setEditingBenefits(prev => ({ ...prev, [benefitsKey]: { ...prev[benefitsKey], outpatientMaternity: e.target.value } }))} className="w-full px-3 py-2 border rounded text-sm" placeholder="e.g., 8 visits with 10% coinsurance..." />
                                            </div>
                                            {/* 10. In-patient Maternity Services */}
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">In-patient Maternity Services</label>
                                              <input type="text" value={editingBenefits[benefitsKey].inpatientMaternity || ''} onChange={(e) => setEditingBenefits(prev => ({ ...prev, [benefitsKey]: { ...prev[benefitsKey], inpatientMaternity: e.target.value } }))} className="w-full px-3 py-2 border rounded text-sm" placeholder="e.g., Normal AED 10,000, C-Section AED 15,000..." />
                                            </div>
                                            {/* 11. Dental */}
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">Dental</label>
                                              <div className="flex gap-2">
                                                <select value={editingBenefits[benefitsKey].dental?.enabled ? 'yes' : 'no'} onChange={(e) => setEditingBenefits(prev => ({ ...prev, [benefitsKey]: { ...prev[benefitsKey], dental: { ...prev[benefitsKey].dental, enabled: e.target.value === 'yes' } } }))} className="px-2 py-2 border rounded text-sm">
                                                  <option value="yes">Yes</option>
                                                  <option value="no">No</option>
                                                </select>
                                                <input type="text" value={editingBenefits[benefitsKey].dental?.value || ''} onChange={(e) => setEditingBenefits(prev => ({ ...prev, [benefitsKey]: { ...prev[benefitsKey], dental: { ...prev[benefitsKey].dental, value: e.target.value } } }))} className="flex-1 px-3 py-2 border rounded text-sm" placeholder="e.g., Up to AED 1,500..." />
                                              </div>
                                            </div>
                                            {/* 11. Optical */}
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">Optical</label>
                                              <div className="flex gap-2">
                                                <select value={editingBenefits[benefitsKey].optical?.enabled ? 'yes' : 'no'} onChange={(e) => setEditingBenefits(prev => ({ ...prev, [benefitsKey]: { ...prev[benefitsKey], optical: { ...prev[benefitsKey].optical, enabled: e.target.value === 'yes' } } }))} className="px-2 py-2 border rounded text-sm">
                                                  <option value="yes">Yes</option>
                                                  <option value="no">No</option>
                                                </select>
                                                <input type="text" value={editingBenefits[benefitsKey].optical?.value || ''} onChange={(e) => setEditingBenefits(prev => ({ ...prev, [benefitsKey]: { ...prev[benefitsKey], optical: { ...prev[benefitsKey].optical, value: e.target.value } } }))} className="flex-1 px-3 py-2 border rounded text-sm" placeholder="e.g., Covered..." />
                                              </div>
                                            </div>
                                            {/* 12. Alternative Medicine */}
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">Alternative Medicine</label>
                                              <div className="flex gap-2">
                                                <select value={editingBenefits[benefitsKey].alternativeMedicine?.enabled ? 'yes' : 'no'} onChange={(e) => setEditingBenefits(prev => ({ ...prev, [benefitsKey]: { ...prev[benefitsKey], alternativeMedicine: { ...prev[benefitsKey].alternativeMedicine, enabled: e.target.value === 'yes' } } }))} className="px-2 py-2 border rounded text-sm">
                                                  <option value="yes">Yes</option>
                                                  <option value="no">No</option>
                                                </select>
                                                <input type="text" value={editingBenefits[benefitsKey].alternativeMedicine?.value || ''} onChange={(e) => setEditingBenefits(prev => ({ ...prev, [benefitsKey]: { ...prev[benefitsKey], alternativeMedicine: { ...prev[benefitsKey].alternativeMedicine, value: e.target.value } } }))} className="flex-1 px-3 py-2 border rounded text-sm" placeholder="e.g., Acupuncture, Ayurveda..." />
                                              </div>
                                            </div>
                                          </div>
                                          <div className="mt-4 flex justify-end">
                                            <button onClick={() => updateBenefits(member.id, plan.id)} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">💾 Save Benefits</button>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Report History Modal */}
        {showReportHistory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full m-4 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">📁 Report History</h3>
                <button onClick={() => setShowReportHistory(false)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
              </div>
              
              {reportHistory.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No reports saved yet</p>
              ) : (
                <div className="space-y-2">
                  {reportHistory.map(report => (
                    <div key={report.id} className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-800">{report.name}</p>
                        <p className="text-xs text-gray-500">{new Date(report.timestamp).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => loadReportFromHistory(report.id)} className="px-3 py-1 bg-purple-600 text-white rounded text-sm">Load</button>
                        <button onClick={() => deleteReportFromHistory(report.id)} className="px-3 py-1 bg-red-500 text-white rounded text-sm">🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="mt-4 flex justify-end">
                <button onClick={() => { if (window.confirm('Clear all history?')) { localStorage.removeItem(STORAGE_KEYS.REPORT_HISTORY); setReportHistory([]); } }} className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm">Clear All</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}