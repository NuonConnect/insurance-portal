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
  maternityEnabled: boolean;
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
  status: 'none' | 'renewal' | 'alternative' | 'recommended';
  benefits: PlanBenefits;
  isManual?: boolean;
  providerKey?: string;
  planLocation?: string;
  salaryCategory?: string;
  needsManualRate?: boolean;
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
  MANUAL_PLANS: 'nsib_manual_plans',
  CUSTOM_PROVIDERS: 'nsib_custom_providers'
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

// MEDNET Benefits Template (Standard benefits for all MEDNET networks)
const MEDNET_BENEFITS: PlanBenefits = {
  areaOfCover: 'Worldwide',
  annualLimit: 'AED 1 Million',
  network: 'MEDNET Network (OP Access to Clinics only, 10PM-8AM Hospital access)',
  consultationDeductible: '20% max AED 50 per consultation',
  prescribedDrugs: 'Covered with 0% copay per invoice',
  diagnostics: 'Covered with 0% copay per invoice (X-Ray, MRI, CT-Scan, Ultrasound, Endoscopy)',
  preexistingCondition: 'Declared conditions covered with sub limit AED 150,000. Undeclared not covered during policy period.',
  physiotherapy: 'Covered with 0% copay up to 15 sessions per member per year (Subject to Prior Approval)',
  outpatientMaternity: '10% co-payment applicable on all Maternity treatments including consultations',
  inpatientMaternity: 'Normal Delivery up to AED 10,000, C-Section up to AED 10,000, Emergency up to AED 150,000 (10% copay)',
  dental: { enabled: true, value: 'Covered with 20% copay up to AED 3,500 (Consultation, X-Ray, Scaling, Extraction, Fillings, Root Canal, Crown)' },
  optical: { enabled: false, value: 'Emergency cases only' },
  alternativeMedicine: { enabled: true, value: 'Covered on reimbursement up to AED 1,600 (Osteopathy, Chiropractic, Homeopathy, Acupuncture, Ayurveda, Herbal)' },
  inpatient: 'Covered with prior approval. Private room. ICU and Coronary care covered.',
  outpatient: 'MEDNET Network - Clinics only during day, Hospitals 10PM-8AM',
  emergency: 'Covered 100% of actual cost within and outside network',
  maternity: '10% copay. Normal/C-Section up to AED 10,000 each. Emergency up to AED 150,000',
  preexisting: { type: 'underwriting', value: 'Declared conditions covered up to AED 150,000. Undeclared not covered.' },
  pharmacyLimit: 'Covered with 0% copay up to Annual Benefit Limit',
  consultation: '20% copay max AED 50. Follow-up within 7 days with same doctor - No copay'
};

// NEXTCARE Benefits Template (Based on Orient TOB-Dubai PDF - March 2025)
const NEXTCARE_BENEFITS: PlanBenefits = {
  areaOfCover: 'Worldwide',
  annualLimit: 'AED 1 Million',
  network: 'NEXTCARE Network (OP restricted to Clinics for different network)',
  consultationDeductible: '20% max AED 50 per consultation (No copay for follow-up within 7 days with same doctor)',
  prescribedDrugs: 'Covered up to AED 5,000-15,000 subject to 15% Co-Insurance',
  diagnostics: 'Covered subject to 10% Co-pay (X-Ray, MRI, CT-Scan, Ultrasound, Endoscopy)',
  preexistingCondition: 'Declared conditions covered up to AED 150,000. Subject to MAF. Undeclared not covered during policy period.',
  physiotherapy: '8-20 sessions per member per annum (Subject to Pre-approval)',
  outpatientMaternity: '10% coinsurance, max 10-15 visits and 4-8 ante-natal ultrasound scans',
  inpatientMaternity: 'Up to AED 10,000-20,000 (10% copay). Emergency covered up to Annual Limit.',
  dental: { enabled: true, value: 'Covered up to AED 500-3,000 subject to 20-30% Co-pay (Consultation, X-Ray, Scaling, Extraction, Fillings, Root Canal)' },
  optical: { enabled: true, value: 'Covered up to AED 1,000-1,500 subject to 20% Co-pay (Frames, Lenses, Contact Lenses)' },
  alternativeMedicine: { enabled: true, value: 'Covered up to AED 2,500 subject to 20% copay on reimbursement (Ayurveda, Chiropractic, Chinese Medicine, Homeopathy)' },
  inpatient: 'Covered with prior approval. Private/Semi-Private room. ICU covered.',
  outpatient: 'NEXTCARE Network - Direct billing available',
  emergency: 'Covered. Ambulance services covered.',
  maternity: '10% copay. Normal/C-Section up to AED 10,000-20,000. Emergency up to Annual Limit.',
  preexisting: { type: 'underwriting', value: 'Declared conditions covered up to AED 150,000. Undeclared not covered.' },
  pharmacyLimit: 'Covered up to AED 5,000-15,000 subject to 15% Co-Insurance',
  consultation: '20% copay max AED 50. Follow-up within 7 days with same doctor - No copay'
};

// NAS Benefits Template (Based on NAS-PLAN PDFs - Opal/Marjan/Silver)
const NAS_BENEFITS: PlanBenefits = {
  areaOfCover: 'Worldwide',
  annualLimit: 'AED 1 Million',
  network: 'NAS Network (OP Restricted to Clinics, GP referral required prior to Specialist access)',
  consultationDeductible: 'GP: 10% up to AED 15-25, Specialist: 20% up to AED 25-60 (No copay for follow-up within 7 days)',
  prescribedDrugs: 'Covered up to AED 4,500-5,000 subject to 15% Co-Insurance',
  diagnostics: 'Covered subject to 10% Co-pay (X-Ray, MRI, CT-Scan, Ultrasound, Endoscopy)',
  preexistingCondition: 'Declared conditions covered up to AED 150,000. Subject to MAF. Undeclared not covered during policy period.',
  physiotherapy: '6-8 sessions per member per annum (Subject to Pre-approval)',
  outpatientMaternity: '10% coinsurance, max 10-12 visits and 4-8 ante-natal ultrasound scans',
  inpatientMaternity: 'Normal Delivery up to AED 10,000-12,500, C-Section up to AED 10,000-12,500 (10% copay)',
  dental: { enabled: true, value: 'Covered up to AED 500-1,500 subject to 20-30% Co-pay (Consultation, X-Ray, Scaling, Extraction, Fillings, Root Canal)' },
  optical: { enabled: false, value: 'Not Covered / Up to AED 1,000 with 20% copay' },
  alternativeMedicine: { enabled: false, value: 'Not Covered / Up to AED 1,000 on reimbursement' },
  inpatient: 'Covered with prior approval. Semi-Private/Private room. ICU and Coronary care covered.',
  outpatient: 'NAS Network - OP Restricted to Clinics',
  emergency: 'Covered. Ambulance services covered.',
  maternity: '10% copay. Normal/C-Section up to AED 10,000-12,500 each. Emergency up to Annual Limit',
  preexisting: { type: 'underwriting', value: 'Declared conditions covered up to AED 150,000. Undeclared not covered.' },
  pharmacyLimit: 'Covered up to AED 4,500-5,000 subject to 15% Co-Insurance',
  consultation: 'GP: 10% up to AED 15-25, Specialist: 20% up to AED 25-60'
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
    'SILVER': { '0-5': {M: 2500, F: 2500}, '6-15': {M: 2200, F: 2200}, '16-20': {M: 2800, F: 3200}, '21-30': {M: 3456, F: 4500}, '31-40': {M: 3900, F: 5000}, '41-50': {M: 4600, F: 5800}, '51-60': {M: 6000, F: 7000}, '61-65': {M: 8000, F: 9500} },
    // MEDNET Plans
    'MEDNET_SILKROAD_0': { '0-5': {M: 2200, F: 2200}, '6-17': {M: 1500, F: 1500}, '18-30': {M: 1700, F: 2800}, '31-40': {M: 2200, F: 3500}, '41-50': {M: 3000, F: 4000}, '51-60': {M: 4300, F: 5300}, '61-65': {M: 6200, F: 7400} },
    'MEDNET_SILKROAD_10': { '0-5': {M: 1980, F: 1980}, '6-17': {M: 1350, F: 1350}, '18-30': {M: 1530, F: 2520}, '31-40': {M: 1980, F: 3150}, '41-50': {M: 2700, F: 3600}, '51-60': {M: 3870, F: 4770}, '61-65': {M: 5580, F: 6660} },
    'MEDNET_SILKROAD_20': { '0-5': {M: 1760, F: 1760}, '6-17': {M: 1200, F: 1200}, '18-30': {M: 1360, F: 2240}, '31-40': {M: 1760, F: 2800}, '41-50': {M: 2400, F: 3200}, '51-60': {M: 3440, F: 4240}, '61-65': {M: 4960, F: 5920} },
    'MEDNET_PEARL_0': { '0-5': {M: 2800, F: 2800}, '6-17': {M: 1900, F: 1900}, '18-30': {M: 2150, F: 3550}, '31-40': {M: 2800, F: 4450}, '41-50': {M: 3800, F: 5100}, '51-60': {M: 5450, F: 6750}, '61-65': {M: 7850, F: 9400} },
    'MEDNET_PEARL_10': { '0-5': {M: 2520, F: 2520}, '6-17': {M: 1710, F: 1710}, '18-30': {M: 1935, F: 3195}, '31-40': {M: 2520, F: 4005}, '41-50': {M: 3420, F: 4590}, '51-60': {M: 4905, F: 6075}, '61-65': {M: 7065, F: 8460} },
    'MEDNET_PEARL_20': { '0-5': {M: 2240, F: 2240}, '6-17': {M: 1520, F: 1520}, '18-30': {M: 1720, F: 2840}, '31-40': {M: 2240, F: 3560}, '41-50': {M: 3040, F: 4080}, '51-60': {M: 4360, F: 5400}, '61-65': {M: 6280, F: 7520} },
    'MEDNET_EMERALD_0': { '0-5': {M: 3400, F: 3400}, '6-17': {M: 2300, F: 2300}, '18-30': {M: 2600, F: 4300}, '31-40': {M: 3400, F: 5400}, '41-50': {M: 4600, F: 6200}, '51-60': {M: 6600, F: 8200}, '61-65': {M: 9500, F: 11400} },
    'MEDNET_EMERALD_10': { '0-5': {M: 3060, F: 3060}, '6-17': {M: 2070, F: 2070}, '18-30': {M: 2340, F: 3870}, '31-40': {M: 3060, F: 4860}, '41-50': {M: 4140, F: 5580}, '51-60': {M: 5940, F: 7380}, '61-65': {M: 8550, F: 10260} },
    'MEDNET_EMERALD_20': { '0-5': {M: 2720, F: 2720}, '6-17': {M: 1840, F: 1840}, '18-30': {M: 2080, F: 3440}, '31-40': {M: 2720, F: 4320}, '41-50': {M: 3680, F: 4960}, '51-60': {M: 5280, F: 6560}, '61-65': {M: 7600, F: 9120} },
    'MEDNET_GREEN_0': { '0-5': {M: 4000, F: 4000}, '6-17': {M: 2700, F: 2700}, '18-30': {M: 3050, F: 5050}, '31-40': {M: 4000, F: 6350}, '41-50': {M: 5400, F: 7300}, '51-60': {M: 7750, F: 9650}, '61-65': {M: 11150, F: 13400} },
    'MEDNET_GREEN_10': { '0-5': {M: 3600, F: 3600}, '6-17': {M: 2430, F: 2430}, '18-30': {M: 2745, F: 4545}, '31-40': {M: 3600, F: 5715}, '41-50': {M: 4860, F: 6570}, '51-60': {M: 6975, F: 8685}, '61-65': {M: 10035, F: 12060} },
    'MEDNET_GREEN_20': { '0-5': {M: 3200, F: 3200}, '6-17': {M: 2160, F: 2160}, '18-30': {M: 2440, F: 4040}, '31-40': {M: 3200, F: 5080}, '41-50': {M: 4320, F: 5840}, '51-60': {M: 6200, F: 7720}, '61-65': {M: 8920, F: 10720} },
    'MEDNET_SILVER_CLASSIC_0': { '0-5': {M: 4600, F: 4600}, '6-17': {M: 3100, F: 3100}, '18-30': {M: 3500, F: 5800}, '31-40': {M: 4600, F: 7300}, '41-50': {M: 6200, F: 8400}, '51-60': {M: 8900, F: 11100}, '61-65': {M: 12800, F: 15400} },
    'MEDNET_SILVER_CLASSIC_10': { '0-5': {M: 4140, F: 4140}, '6-17': {M: 2790, F: 2790}, '18-30': {M: 3150, F: 5220}, '31-40': {M: 4140, F: 6570}, '41-50': {M: 5580, F: 7560}, '51-60': {M: 8010, F: 9990}, '61-65': {M: 11520, F: 13860} },
    'MEDNET_SILVER_CLASSIC_20': { '0-5': {M: 3680, F: 3680}, '6-17': {M: 2480, F: 2480}, '18-30': {M: 2800, F: 4640}, '31-40': {M: 3680, F: 5840}, '41-50': {M: 4960, F: 6720}, '51-60': {M: 7120, F: 8880}, '61-65': {M: 10240, F: 12320} },
    'MEDNET_SILVER_PREMIUM_0': { '0-5': {M: 5200, F: 5200}, '6-17': {M: 3500, F: 3500}, '18-30': {M: 3950, F: 6550}, '31-40': {M: 5200, F: 8250}, '41-50': {M: 7000, F: 9500}, '51-60': {M: 10050, F: 12550}, '61-65': {M: 14450, F: 17400} },
    'MEDNET_SILVER_PREMIUM_10': { '0-5': {M: 4680, F: 4680}, '6-17': {M: 3150, F: 3150}, '18-30': {M: 3555, F: 5895}, '31-40': {M: 4680, F: 7425}, '41-50': {M: 6300, F: 8550}, '51-60': {M: 9045, F: 11295}, '61-65': {M: 13005, F: 15660} },
    'MEDNET_SILVER_PREMIUM_20': { '0-5': {M: 4160, F: 4160}, '6-17': {M: 2800, F: 2800}, '18-30': {M: 3160, F: 5240}, '31-40': {M: 4160, F: 6600}, '41-50': {M: 5600, F: 7600}, '51-60': {M: 8040, F: 10040}, '61-65': {M: 11560, F: 13920} },
    'MEDNET_GOLD_0': { '0-5': {M: 5800, F: 5800}, '6-17': {M: 3900, F: 3900}, '18-30': {M: 4400, F: 7300}, '31-40': {M: 5800, F: 9200}, '41-50': {M: 7800, F: 10600}, '51-60': {M: 11200, F: 14000}, '61-65': {M: 16100, F: 19400} },
    'MEDNET_GOLD_10': { '0-5': {M: 5220, F: 5220}, '6-17': {M: 3510, F: 3510}, '18-30': {M: 3960, F: 6570}, '31-40': {M: 5220, F: 8280}, '41-50': {M: 7020, F: 9540}, '51-60': {M: 10080, F: 12600}, '61-65': {M: 14490, F: 17460} },
    'MEDNET_GOLD_20': { '0-5': {M: 4640, F: 4640}, '6-17': {M: 3120, F: 3120}, '18-30': {M: 3520, F: 5840}, '31-40': {M: 4640, F: 7360}, '41-50': {M: 6240, F: 8480}, '51-60': {M: 8960, F: 11200}, '61-65': {M: 12880, F: 15520} }
  },
  // ORIENT MEDNET Plans
  'ORIENT_MEDNET': {
    'MEDNET_SILKROAD_0': { '0-5': {M: 2100, F: 2100}, '6-17': {M: 1400, F: 1400}, '18-30': {M: 1600, F: 2650}, '31-40': {M: 2100, F: 3350}, '41-50': {M: 2850, F: 3850}, '51-60': {M: 4100, F: 5100}, '61-65': {M: 5900, F: 7100} },
    'MEDNET_SILKROAD_10': { '0-5': {M: 1890, F: 1890}, '6-17': {M: 1260, F: 1260}, '18-30': {M: 1440, F: 2385}, '31-40': {M: 1890, F: 3015}, '41-50': {M: 2565, F: 3465}, '51-60': {M: 3690, F: 4590}, '61-65': {M: 5310, F: 6390} },
    'MEDNET_SILKROAD_20': { '0-5': {M: 1680, F: 1680}, '6-17': {M: 1120, F: 1120}, '18-30': {M: 1280, F: 2120}, '31-40': {M: 1680, F: 2680}, '41-50': {M: 2280, F: 3080}, '51-60': {M: 3280, F: 4080}, '61-65': {M: 4720, F: 5680} },
    'MEDNET_PEARL_0': { '0-5': {M: 2700, F: 2700}, '6-17': {M: 1800, F: 1800}, '18-30': {M: 2050, F: 3400}, '31-40': {M: 2700, F: 4300}, '41-50': {M: 3650, F: 4950}, '51-60': {M: 5250, F: 6550}, '61-65': {M: 7550, F: 9100} },
    'MEDNET_PEARL_10': { '0-5': {M: 2430, F: 2430}, '6-17': {M: 1620, F: 1620}, '18-30': {M: 1845, F: 3060}, '31-40': {M: 2430, F: 3870}, '41-50': {M: 3285, F: 4455}, '51-60': {M: 4725, F: 5895}, '61-65': {M: 6795, F: 8190} },
    'MEDNET_PEARL_20': { '0-5': {M: 2160, F: 2160}, '6-17': {M: 1440, F: 1440}, '18-30': {M: 1640, F: 2720}, '31-40': {M: 2160, F: 3440}, '41-50': {M: 2920, F: 3960}, '51-60': {M: 4200, F: 5240}, '61-65': {M: 6040, F: 7280} },
    'MEDNET_EMERALD_0': { '0-5': {M: 3300, F: 3300}, '6-17': {M: 2200, F: 2200}, '18-30': {M: 2500, F: 4150}, '31-40': {M: 3300, F: 5250}, '41-50': {M: 4450, F: 6050}, '51-60': {M: 6400, F: 8000}, '61-65': {M: 9200, F: 11100} },
    'MEDNET_EMERALD_10': { '0-5': {M: 2970, F: 2970}, '6-17': {M: 1980, F: 1980}, '18-30': {M: 2250, F: 3735}, '31-40': {M: 2970, F: 4725}, '41-50': {M: 4005, F: 5445}, '51-60': {M: 5760, F: 7200}, '61-65': {M: 8280, F: 9990} },
    'MEDNET_EMERALD_20': { '0-5': {M: 2640, F: 2640}, '6-17': {M: 1760, F: 1760}, '18-30': {M: 2000, F: 3320}, '31-40': {M: 2640, F: 4200}, '41-50': {M: 3560, F: 4840}, '51-60': {M: 5120, F: 6400}, '61-65': {M: 7360, F: 8880} },
    'MEDNET_GREEN_0': { '0-5': {M: 3900, F: 3900}, '6-17': {M: 2600, F: 2600}, '18-30': {M: 2950, F: 4900}, '31-40': {M: 3900, F: 6200}, '41-50': {M: 5250, F: 7150}, '51-60': {M: 7550, F: 9450}, '61-65': {M: 10850, F: 13100} },
    'MEDNET_GREEN_10': { '0-5': {M: 3510, F: 3510}, '6-17': {M: 2340, F: 2340}, '18-30': {M: 2655, F: 4410}, '31-40': {M: 3510, F: 5580}, '41-50': {M: 4725, F: 6435}, '51-60': {M: 6795, F: 8505}, '61-65': {M: 9765, F: 11790} },
    'MEDNET_GREEN_20': { '0-5': {M: 3120, F: 3120}, '6-17': {M: 2080, F: 2080}, '18-30': {M: 2360, F: 3920}, '31-40': {M: 3120, F: 4960}, '41-50': {M: 4200, F: 5720}, '51-60': {M: 6040, F: 7560}, '61-65': {M: 8680, F: 10480} },
    'MEDNET_SILVER_CLASSIC_0': { '0-5': {M: 4500, F: 4500}, '6-17': {M: 3000, F: 3000}, '18-30': {M: 3400, F: 5650}, '31-40': {M: 4500, F: 7150}, '41-50': {M: 6050, F: 8250}, '51-60': {M: 8700, F: 10900}, '61-65': {M: 12500, F: 15100} },
    'MEDNET_SILVER_CLASSIC_10': { '0-5': {M: 4050, F: 4050}, '6-17': {M: 2700, F: 2700}, '18-30': {M: 3060, F: 5085}, '31-40': {M: 4050, F: 6435}, '41-50': {M: 5445, F: 7425}, '51-60': {M: 7830, F: 9810}, '61-65': {M: 11250, F: 13590} },
    'MEDNET_SILVER_CLASSIC_20': { '0-5': {M: 3600, F: 3600}, '6-17': {M: 2400, F: 2400}, '18-30': {M: 2720, F: 4520}, '31-40': {M: 3600, F: 5720}, '41-50': {M: 4840, F: 6600}, '51-60': {M: 6960, F: 8720}, '61-65': {M: 10000, F: 12080} },
    'MEDNET_SILVER_PREMIUM_0': { '0-5': {M: 5100, F: 5100}, '6-17': {M: 3400, F: 3400}, '18-30': {M: 3850, F: 6400}, '31-40': {M: 5100, F: 8100}, '41-50': {M: 6850, F: 9350}, '51-60': {M: 9850, F: 12350}, '61-65': {M: 14150, F: 17100} },
    'MEDNET_SILVER_PREMIUM_10': { '0-5': {M: 4590, F: 4590}, '6-17': {M: 3060, F: 3060}, '18-30': {M: 3465, F: 5760}, '31-40': {M: 4590, F: 7290}, '41-50': {M: 6165, F: 8415}, '51-60': {M: 8865, F: 11115}, '61-65': {M: 12735, F: 15390} },
    'MEDNET_SILVER_PREMIUM_20': { '0-5': {M: 4080, F: 4080}, '6-17': {M: 2720, F: 2720}, '18-30': {M: 3080, F: 5120}, '31-40': {M: 4080, F: 6480}, '41-50': {M: 5480, F: 7480}, '51-60': {M: 7880, F: 9880}, '61-65': {M: 11320, F: 13680} },
    'MEDNET_GOLD_0': { '0-5': {M: 5700, F: 5700}, '6-17': {M: 3800, F: 3800}, '18-30': {M: 4300, F: 7150}, '31-40': {M: 5700, F: 9050}, '41-50': {M: 7650, F: 10450}, '51-60': {M: 11000, F: 13800}, '61-65': {M: 15800, F: 19100} },
    'MEDNET_GOLD_10': { '0-5': {M: 5130, F: 5130}, '6-17': {M: 3420, F: 3420}, '18-30': {M: 3870, F: 6435}, '31-40': {M: 5130, F: 8145}, '41-50': {M: 6885, F: 9405}, '51-60': {M: 9900, F: 12420}, '61-65': {M: 14220, F: 17190} },
    'MEDNET_GOLD_20': { '0-5': {M: 4560, F: 4560}, '6-17': {M: 3040, F: 3040}, '18-30': {M: 3440, F: 5720}, '31-40': {M: 4560, F: 7240}, '41-50': {M: 6120, F: 8360}, '51-60': {M: 8800, F: 11040}, '61-65': {M: 12640, F: 15280} }
  },
  // DUBAI INSURANCE MEDNET Plans
  'DUBAI_INSURANCE_MEDNET': {
    'MEDNET_SILKROAD_0': { '0-5': {M: 2300, F: 2300}, '6-17': {M: 1550, F: 1550}, '18-30': {M: 1750, F: 2900}, '31-40': {M: 2300, F: 3650}, '41-50': {M: 3100, F: 4200}, '51-60': {M: 4450, F: 5550}, '61-65': {M: 6400, F: 7700} },
    'MEDNET_SILKROAD_10': { '0-5': {M: 2070, F: 2070}, '6-17': {M: 1395, F: 1395}, '18-30': {M: 1575, F: 2610}, '31-40': {M: 2070, F: 3285}, '41-50': {M: 2790, F: 3780}, '51-60': {M: 4005, F: 4995}, '61-65': {M: 5760, F: 6930} },
    'MEDNET_SILKROAD_20': { '0-5': {M: 1840, F: 1840}, '6-17': {M: 1240, F: 1240}, '18-30': {M: 1400, F: 2320}, '31-40': {M: 1840, F: 2920}, '41-50': {M: 2480, F: 3360}, '51-60': {M: 3560, F: 4440}, '61-65': {M: 5120, F: 6160} },
    'MEDNET_PEARL_0': { '0-5': {M: 2900, F: 2900}, '6-17': {M: 1950, F: 1950}, '18-30': {M: 2200, F: 3650}, '31-40': {M: 2900, F: 4600}, '41-50': {M: 3900, F: 5300}, '51-60': {M: 5600, F: 7000}, '61-65': {M: 8050, F: 9700} },
    'MEDNET_PEARL_10': { '0-5': {M: 2610, F: 2610}, '6-17': {M: 1755, F: 1755}, '18-30': {M: 1980, F: 3285}, '31-40': {M: 2610, F: 4140}, '41-50': {M: 3510, F: 4770}, '51-60': {M: 5040, F: 6300}, '61-65': {M: 7245, F: 8730} },
    'MEDNET_PEARL_20': { '0-5': {M: 2320, F: 2320}, '6-17': {M: 1560, F: 1560}, '18-30': {M: 1760, F: 2920}, '31-40': {M: 2320, F: 3680}, '41-50': {M: 3120, F: 4240}, '51-60': {M: 4480, F: 5600}, '61-65': {M: 6440, F: 7760} },
    'MEDNET_EMERALD_0': { '0-5': {M: 3500, F: 3500}, '6-17': {M: 2350, F: 2350}, '18-30': {M: 2650, F: 4400}, '31-40': {M: 3500, F: 5550}, '41-50': {M: 4700, F: 6400}, '51-60': {M: 6750, F: 8450}, '61-65': {M: 9700, F: 11700} },
    'MEDNET_EMERALD_10': { '0-5': {M: 3150, F: 3150}, '6-17': {M: 2115, F: 2115}, '18-30': {M: 2385, F: 3960}, '31-40': {M: 3150, F: 4995}, '41-50': {M: 4230, F: 5760}, '51-60': {M: 6075, F: 7605}, '61-65': {M: 8730, F: 10530} },
    'MEDNET_EMERALD_20': { '0-5': {M: 2800, F: 2800}, '6-17': {M: 1880, F: 1880}, '18-30': {M: 2120, F: 3520}, '31-40': {M: 2800, F: 4440}, '41-50': {M: 3760, F: 5120}, '51-60': {M: 5400, F: 6760}, '61-65': {M: 7760, F: 9360} },
    'MEDNET_GREEN_0': { '0-5': {M: 4100, F: 4100}, '6-17': {M: 2750, F: 2750}, '18-30': {M: 3100, F: 5150}, '31-40': {M: 4100, F: 6500}, '41-50': {M: 5500, F: 7500}, '51-60': {M: 7900, F: 9900}, '61-65': {M: 11350, F: 13700} },
    'MEDNET_GREEN_10': { '0-5': {M: 3690, F: 3690}, '6-17': {M: 2475, F: 2475}, '18-30': {M: 2790, F: 4635}, '31-40': {M: 3690, F: 5850}, '41-50': {M: 4950, F: 6750}, '51-60': {M: 7110, F: 8910}, '61-65': {M: 10215, F: 12330} },
    'MEDNET_GREEN_20': { '0-5': {M: 3280, F: 3280}, '6-17': {M: 2200, F: 2200}, '18-30': {M: 2480, F: 4120}, '31-40': {M: 3280, F: 5200}, '41-50': {M: 4400, F: 6000}, '51-60': {M: 6320, F: 7920}, '61-65': {M: 9080, F: 10960} },
    'MEDNET_SILVER_CLASSIC_0': { '0-5': {M: 4700, F: 4700}, '6-17': {M: 3150, F: 3150}, '18-30': {M: 3550, F: 5900}, '31-40': {M: 4700, F: 7450}, '41-50': {M: 6300, F: 8600}, '51-60': {M: 9050, F: 11350}, '61-65': {M: 13000, F: 15700} },
    'MEDNET_SILVER_CLASSIC_10': { '0-5': {M: 4230, F: 4230}, '6-17': {M: 2835, F: 2835}, '18-30': {M: 3195, F: 5310}, '31-40': {M: 4230, F: 6705}, '41-50': {M: 5670, F: 7740}, '51-60': {M: 8145, F: 10215}, '61-65': {M: 11700, F: 14130} },
    'MEDNET_SILVER_CLASSIC_20': { '0-5': {M: 3760, F: 3760}, '6-17': {M: 2520, F: 2520}, '18-30': {M: 2840, F: 4720}, '31-40': {M: 3760, F: 5960}, '41-50': {M: 5040, F: 6880}, '51-60': {M: 7240, F: 9080}, '61-65': {M: 10400, F: 12560} },
    'MEDNET_SILVER_PREMIUM_0': { '0-5': {M: 5300, F: 5300}, '6-17': {M: 3550, F: 3550}, '18-30': {M: 4000, F: 6650}, '31-40': {M: 5300, F: 8400}, '41-50': {M: 7100, F: 9700}, '51-60': {M: 10200, F: 12800}, '61-65': {M: 14650, F: 17700} },
    'MEDNET_SILVER_PREMIUM_10': { '0-5': {M: 4770, F: 4770}, '6-17': {M: 3195, F: 3195}, '18-30': {M: 3600, F: 5985}, '31-40': {M: 4770, F: 7560}, '41-50': {M: 6390, F: 8730}, '51-60': {M: 9180, F: 11520}, '61-65': {M: 13185, F: 15930} },
    'MEDNET_SILVER_PREMIUM_20': { '0-5': {M: 4240, F: 4240}, '6-17': {M: 2840, F: 2840}, '18-30': {M: 3200, F: 5320}, '31-40': {M: 4240, F: 6720}, '41-50': {M: 5680, F: 7760}, '51-60': {M: 8160, F: 10240}, '61-65': {M: 11720, F: 14160} },
    'MEDNET_GOLD_0': { '0-5': {M: 5900, F: 5900}, '6-17': {M: 3950, F: 3950}, '18-30': {M: 4450, F: 7400}, '31-40': {M: 5900, F: 9350}, '41-50': {M: 7900, F: 10800}, '51-60': {M: 11350, F: 14250}, '61-65': {M: 16300, F: 19700} },
    'MEDNET_GOLD_10': { '0-5': {M: 5310, F: 5310}, '6-17': {M: 3555, F: 3555}, '18-30': {M: 4005, F: 6660}, '31-40': {M: 5310, F: 8415}, '41-50': {M: 7110, F: 9720}, '51-60': {M: 10215, F: 12825}, '61-65': {M: 14670, F: 17730} },
    'MEDNET_GOLD_20': { '0-5': {M: 4720, F: 4720}, '6-17': {M: 3160, F: 3160}, '18-30': {M: 3560, F: 5920}, '31-40': {M: 4720, F: 7480}, '41-50': {M: 6320, F: 8640}, '51-60': {M: 9080, F: 11400}, '61-65': {M: 13040, F: 15760} }
  },
  // LIVA MEDNET Plans
  'LIVA_MEDNET': {
    'MEDNET_SILKROAD_0': { '0-5': {M: 2050, F: 2050}, '6-17': {M: 1380, F: 1380}, '18-30': {M: 1560, F: 2580}, '31-40': {M: 2050, F: 3250}, '41-50': {M: 2760, F: 3740}, '51-60': {M: 3970, F: 4940}, '61-65': {M: 5710, F: 6870} },
    'MEDNET_SILKROAD_10': { '0-5': {M: 1845, F: 1845}, '6-17': {M: 1242, F: 1242}, '18-30': {M: 1404, F: 2322}, '31-40': {M: 1845, F: 2925}, '41-50': {M: 2484, F: 3366}, '51-60': {M: 3573, F: 4446}, '61-65': {M: 5139, F: 6183} },
    'MEDNET_SILKROAD_20': { '0-5': {M: 1640, F: 1640}, '6-17': {M: 1104, F: 1104}, '18-30': {M: 1248, F: 2064}, '31-40': {M: 1640, F: 2600}, '41-50': {M: 2208, F: 2992}, '51-60': {M: 3176, F: 3952}, '61-65': {M: 4568, F: 5496} },
    'MEDNET_PEARL_0': { '0-5': {M: 2650, F: 2650}, '6-17': {M: 1780, F: 1780}, '18-30': {M: 2010, F: 3330}, '31-40': {M: 2650, F: 4200}, '41-50': {M: 3570, F: 4840}, '51-60': {M: 5130, F: 6390}, '61-65': {M: 7380, F: 8880} },
    'MEDNET_PEARL_10': { '0-5': {M: 2385, F: 2385}, '6-17': {M: 1602, F: 1602}, '18-30': {M: 1809, F: 2997}, '31-40': {M: 2385, F: 3780}, '41-50': {M: 3213, F: 4356}, '51-60': {M: 4617, F: 5751}, '61-65': {M: 6642, F: 7992} },
    'MEDNET_PEARL_20': { '0-5': {M: 2120, F: 2120}, '6-17': {M: 1424, F: 1424}, '18-30': {M: 1608, F: 2664}, '31-40': {M: 2120, F: 3360}, '41-50': {M: 2856, F: 3872}, '51-60': {M: 4104, F: 5112}, '61-65': {M: 5904, F: 7104} },
    'MEDNET_EMERALD_0': { '0-5': {M: 3250, F: 3250}, '6-17': {M: 2180, F: 2180}, '18-30': {M: 2460, F: 4080}, '31-40': {M: 3250, F: 5150}, '41-50': {M: 4380, F: 5940}, '51-60': {M: 6290, F: 7840}, '61-65': {M: 9050, F: 10890} },
    'MEDNET_EMERALD_10': { '0-5': {M: 2925, F: 2925}, '6-17': {M: 1962, F: 1962}, '18-30': {M: 2214, F: 3672}, '31-40': {M: 2925, F: 4635}, '41-50': {M: 3942, F: 5346}, '51-60': {M: 5661, F: 7056}, '61-65': {M: 8145, F: 9801} },
    'MEDNET_EMERALD_20': { '0-5': {M: 2600, F: 2600}, '6-17': {M: 1744, F: 1744}, '18-30': {M: 1968, F: 3264}, '31-40': {M: 2600, F: 4120}, '41-50': {M: 3504, F: 4752}, '51-60': {M: 5032, F: 6272}, '61-65': {M: 7240, F: 8712} },
    'MEDNET_GREEN_0': { '0-5': {M: 3850, F: 3850}, '6-17': {M: 2580, F: 2580}, '18-30': {M: 2910, F: 4830}, '31-40': {M: 3850, F: 6100}, '41-50': {M: 5180, F: 7040}, '51-60': {M: 7440, F: 9280}, '61-65': {M: 10700, F: 12880} },
    'MEDNET_GREEN_10': { '0-5': {M: 3465, F: 3465}, '6-17': {M: 2322, F: 2322}, '18-30': {M: 2619, F: 4347}, '31-40': {M: 3465, F: 5490}, '41-50': {M: 4662, F: 6336}, '51-60': {M: 6696, F: 8352}, '61-65': {M: 9630, F: 11592} },
    'MEDNET_GREEN_20': { '0-5': {M: 3080, F: 3080}, '6-17': {M: 2064, F: 2064}, '18-30': {M: 2328, F: 3864}, '31-40': {M: 3080, F: 4880}, '41-50': {M: 4144, F: 5632}, '51-60': {M: 5952, F: 7424}, '61-65': {M: 8560, F: 10304} },
    'MEDNET_SILVER_CLASSIC_0': { '0-5': {M: 4450, F: 4450}, '6-17': {M: 2980, F: 2980}, '18-30': {M: 3360, F: 5580}, '31-40': {M: 4450, F: 7050}, '41-50': {M: 5990, F: 8140}, '51-60': {M: 8600, F: 10720}, '61-65': {M: 12370, F: 14890} },
    'MEDNET_SILVER_CLASSIC_10': { '0-5': {M: 4005, F: 4005}, '6-17': {M: 2682, F: 2682}, '18-30': {M: 3024, F: 5022}, '31-40': {M: 4005, F: 6345}, '41-50': {M: 5391, F: 7326}, '51-60': {M: 7740, F: 9648}, '61-65': {M: 11133, F: 13401} },
    'MEDNET_SILVER_CLASSIC_20': { '0-5': {M: 3560, F: 3560}, '6-17': {M: 2384, F: 2384}, '18-30': {M: 2688, F: 4464}, '31-40': {M: 3560, F: 5640}, '41-50': {M: 4792, F: 6512}, '51-60': {M: 6880, F: 8576}, '61-65': {M: 9896, F: 11912} },
    'MEDNET_SILVER_PREMIUM_0': { '0-5': {M: 5050, F: 5050}, '6-17': {M: 3380, F: 3380}, '18-30': {M: 3810, F: 6330}, '31-40': {M: 5050, F: 8000}, '41-50': {M: 6790, F: 9230}, '51-60': {M: 9760, F: 12160}, '61-65': {M: 14030, F: 16890} },
    'MEDNET_SILVER_PREMIUM_10': { '0-5': {M: 4545, F: 4545}, '6-17': {M: 3042, F: 3042}, '18-30': {M: 3429, F: 5697}, '31-40': {M: 4545, F: 7200}, '41-50': {M: 6111, F: 8307}, '51-60': {M: 8784, F: 10944}, '61-65': {M: 12627, F: 15201} },
    'MEDNET_SILVER_PREMIUM_20': { '0-5': {M: 4040, F: 4040}, '6-17': {M: 2704, F: 2704}, '18-30': {M: 3048, F: 5064}, '31-40': {M: 4040, F: 6400}, '41-50': {M: 5432, F: 7384}, '51-60': {M: 7808, F: 9728}, '61-65': {M: 11224, F: 13512} },
    'MEDNET_GOLD_0': { '0-5': {M: 5650, F: 5650}, '6-17': {M: 3780, F: 3780}, '18-30': {M: 4260, F: 7080}, '31-40': {M: 5650, F: 8950}, '41-50': {M: 7600, F: 10340}, '51-60': {M: 10920, F: 13640}, '61-65': {M: 15700, F: 18900} },
    'MEDNET_GOLD_10': { '0-5': {M: 5085, F: 5085}, '6-17': {M: 3402, F: 3402}, '18-30': {M: 3834, F: 6372}, '31-40': {M: 5085, F: 8055}, '41-50': {M: 6840, F: 9306}, '51-60': {M: 9828, F: 12276}, '61-65': {M: 14130, F: 17010} },
    'MEDNET_GOLD_20': { '0-5': {M: 4520, F: 4520}, '6-17': {M: 3024, F: 3024}, '18-30': {M: 3408, F: 5664}, '31-40': {M: 4520, F: 7160}, '41-50': {M: 6080, F: 8272}, '51-60': {M: 8736, F: 10912}, '61-65': {M: 12560, F: 15120} }
  },
  // RAK MEDNET Plans
  'RAK_MEDNET': {
    'MEDNET_SILKROAD_0': { '0-5': {M: 1950, F: 1950}, '6-17': {M: 1310, F: 1310}, '18-30': {M: 1480, F: 2450}, '31-40': {M: 1950, F: 3090}, '41-50': {M: 2630, F: 3560}, '51-60': {M: 3780, F: 4700}, '61-65': {M: 5440, F: 6540} },
    'MEDNET_SILKROAD_10': { '0-5': {M: 1755, F: 1755}, '6-17': {M: 1179, F: 1179}, '18-30': {M: 1332, F: 2205}, '31-40': {M: 1755, F: 2781}, '41-50': {M: 2367, F: 3204}, '51-60': {M: 3402, F: 4230}, '61-65': {M: 4896, F: 5886} },
    'MEDNET_SILKROAD_20': { '0-5': {M: 1560, F: 1560}, '6-17': {M: 1048, F: 1048}, '18-30': {M: 1184, F: 1960}, '31-40': {M: 1560, F: 2472}, '41-50': {M: 2104, F: 2848}, '51-60': {M: 3024, F: 3760}, '61-65': {M: 4352, F: 5232} },
    'MEDNET_PEARL_0': { '0-5': {M: 2550, F: 2550}, '6-17': {M: 1710, F: 1710}, '18-30': {M: 1930, F: 3200}, '31-40': {M: 2550, F: 4040}, '41-50': {M: 3440, F: 4660}, '51-60': {M: 4940, F: 6160}, '61-65': {M: 7110, F: 8560} },
    'MEDNET_PEARL_10': { '0-5': {M: 2295, F: 2295}, '6-17': {M: 1539, F: 1539}, '18-30': {M: 1737, F: 2880}, '31-40': {M: 2295, F: 3636}, '41-50': {M: 3096, F: 4194}, '51-60': {M: 4446, F: 5544}, '61-65': {M: 6399, F: 7704} },
    'MEDNET_PEARL_20': { '0-5': {M: 2040, F: 2040}, '6-17': {M: 1368, F: 1368}, '18-30': {M: 1544, F: 2560}, '31-40': {M: 2040, F: 3232}, '41-50': {M: 2752, F: 3728}, '51-60': {M: 3952, F: 4928}, '61-65': {M: 5688, F: 6848} },
    'MEDNET_EMERALD_0': { '0-5': {M: 3150, F: 3150}, '6-17': {M: 2110, F: 2110}, '18-30': {M: 2380, F: 3950}, '31-40': {M: 3150, F: 4990}, '41-50': {M: 4240, F: 5760}, '51-60': {M: 6090, F: 7600}, '61-65': {M: 8760, F: 10550} },
    'MEDNET_EMERALD_10': { '0-5': {M: 2835, F: 2835}, '6-17': {M: 1899, F: 1899}, '18-30': {M: 2142, F: 3555}, '31-40': {M: 2835, F: 4491}, '41-50': {M: 3816, F: 5184}, '51-60': {M: 5481, F: 6840}, '61-65': {M: 7884, F: 9495} },
    'MEDNET_EMERALD_20': { '0-5': {M: 2520, F: 2520}, '6-17': {M: 1688, F: 1688}, '18-30': {M: 1904, F: 3160}, '31-40': {M: 2520, F: 3992}, '41-50': {M: 3392, F: 4608}, '51-60': {M: 4872, F: 6080}, '61-65': {M: 7008, F: 8440} },
    'MEDNET_GREEN_0': { '0-5': {M: 3750, F: 3750}, '6-17': {M: 2510, F: 2510}, '18-30': {M: 2830, F: 4700}, '31-40': {M: 3750, F: 5940}, '41-50': {M: 5050, F: 6860}, '51-60': {M: 7250, F: 9040}, '61-65': {M: 10430, F: 12560} },
    'MEDNET_GREEN_10': { '0-5': {M: 3375, F: 3375}, '6-17': {M: 2259, F: 2259}, '18-30': {M: 2547, F: 4230}, '31-40': {M: 3375, F: 5346}, '41-50': {M: 4545, F: 6174}, '51-60': {M: 6525, F: 8136}, '61-65': {M: 9387, F: 11304} },
    'MEDNET_GREEN_20': { '0-5': {M: 3000, F: 3000}, '6-17': {M: 2008, F: 2008}, '18-30': {M: 2264, F: 3760}, '31-40': {M: 3000, F: 4752}, '41-50': {M: 4040, F: 5488}, '51-60': {M: 5800, F: 7232}, '61-65': {M: 8344, F: 10048} },
    'MEDNET_SILVER_CLASSIC_0': { '0-5': {M: 4350, F: 4350}, '6-17': {M: 2910, F: 2910}, '18-30': {M: 3280, F: 5450}, '31-40': {M: 4350, F: 6890}, '41-50': {M: 5850, F: 7960}, '51-60': {M: 8400, F: 10480}, '61-65': {M: 12090, F: 14560} },
    'MEDNET_SILVER_CLASSIC_10': { '0-5': {M: 3915, F: 3915}, '6-17': {M: 2619, F: 2619}, '18-30': {M: 2952, F: 4905}, '31-40': {M: 3915, F: 6201}, '41-50': {M: 5265, F: 7164}, '51-60': {M: 7560, F: 9432}, '61-65': {M: 10881, F: 13104} },
    'MEDNET_SILVER_CLASSIC_20': { '0-5': {M: 3480, F: 3480}, '6-17': {M: 2328, F: 2328}, '18-30': {M: 2624, F: 4360}, '31-40': {M: 3480, F: 5512}, '41-50': {M: 4680, F: 6368}, '51-60': {M: 6720, F: 8384}, '61-65': {M: 9672, F: 11648} },
    'MEDNET_SILVER_PREMIUM_0': { '0-5': {M: 4950, F: 4950}, '6-17': {M: 3310, F: 3310}, '18-30': {M: 3730, F: 6200}, '31-40': {M: 4950, F: 7840}, '41-50': {M: 6660, F: 9060}, '51-60': {M: 9560, F: 11920}, '61-65': {M: 13760, F: 16560} },
    'MEDNET_SILVER_PREMIUM_10': { '0-5': {M: 4455, F: 4455}, '6-17': {M: 2979, F: 2979}, '18-30': {M: 3357, F: 5580}, '31-40': {M: 4455, F: 7056}, '41-50': {M: 5994, F: 8154}, '51-60': {M: 8604, F: 10728}, '61-65': {M: 12384, F: 14904} },
    'MEDNET_SILVER_PREMIUM_20': { '0-5': {M: 3960, F: 3960}, '6-17': {M: 2648, F: 2648}, '18-30': {M: 2984, F: 4960}, '31-40': {M: 3960, F: 6272}, '41-50': {M: 5328, F: 7248}, '51-60': {M: 7648, F: 9536}, '61-65': {M: 11008, F: 13248} },
    'MEDNET_GOLD_0': { '0-5': {M: 5550, F: 5550}, '6-17': {M: 3710, F: 3710}, '18-30': {M: 4180, F: 6950}, '31-40': {M: 5550, F: 8790}, '41-50': {M: 7460, F: 10160}, '51-60': {M: 10720, F: 13380}, '61-65': {M: 15420, F: 18560} },
    'MEDNET_GOLD_10': { '0-5': {M: 4995, F: 4995}, '6-17': {M: 3339, F: 3339}, '18-30': {M: 3762, F: 6255}, '31-40': {M: 4995, F: 7911}, '41-50': {M: 6714, F: 9144}, '51-60': {M: 9648, F: 12042}, '61-65': {M: 13878, F: 16704} },
    'MEDNET_GOLD_20': { '0-5': {M: 4440, F: 4440}, '6-17': {M: 2968, F: 2968}, '18-30': {M: 3344, F: 5560}, '31-40': {M: 4440, F: 7032}, '41-50': {M: 5968, F: 8128}, '51-60': {M: 8576, F: 10704}, '61-65': {M: 12336, F: 14848} }
  },
  // WATANIA MEDNET Plans
  'WATANIA_MEDNET': {
    'MEDNET_SILKROAD_0': { '0-5': {M: 1900, F: 1900}, '6-17': {M: 1280, F: 1280}, '18-30': {M: 1450, F: 2400}, '31-40': {M: 1900, F: 3010}, '41-50': {M: 2560, F: 3470}, '51-60': {M: 3680, F: 4580}, '61-65': {M: 5300, F: 6370} },
    'MEDNET_SILKROAD_10': { '0-5': {M: 1710, F: 1710}, '6-17': {M: 1152, F: 1152}, '18-30': {M: 1305, F: 2160}, '31-40': {M: 1710, F: 2709}, '41-50': {M: 2304, F: 3123}, '51-60': {M: 3312, F: 4122}, '61-65': {M: 4770, F: 5733} },
    'MEDNET_SILKROAD_20': { '0-5': {M: 1520, F: 1520}, '6-17': {M: 1024, F: 1024}, '18-30': {M: 1160, F: 1920}, '31-40': {M: 1520, F: 2408}, '41-50': {M: 2048, F: 2776}, '51-60': {M: 2944, F: 3664}, '61-65': {M: 4240, F: 5096} },
    'MEDNET_PEARL_0': { '0-5': {M: 2500, F: 2500}, '6-17': {M: 1680, F: 1680}, '18-30': {M: 1900, F: 3150}, '31-40': {M: 2500, F: 3960}, '41-50': {M: 3370, F: 4560}, '51-60': {M: 4840, F: 6030}, '61-65': {M: 6970, F: 8380} },
    'MEDNET_PEARL_10': { '0-5': {M: 2250, F: 2250}, '6-17': {M: 1512, F: 1512}, '18-30': {M: 1710, F: 2835}, '31-40': {M: 2250, F: 3564}, '41-50': {M: 3033, F: 4104}, '51-60': {M: 4356, F: 5427}, '61-65': {M: 6273, F: 7542} },
    'MEDNET_PEARL_20': { '0-5': {M: 2000, F: 2000}, '6-17': {M: 1344, F: 1344}, '18-30': {M: 1520, F: 2520}, '31-40': {M: 2000, F: 3168}, '41-50': {M: 2696, F: 3648}, '51-60': {M: 3872, F: 4824}, '61-65': {M: 5576, F: 6704} },
    'MEDNET_EMERALD_0': { '0-5': {M: 3100, F: 3100}, '6-17': {M: 2080, F: 2080}, '18-30': {M: 2350, F: 3900}, '31-40': {M: 3100, F: 4910}, '41-50': {M: 4180, F: 5660}, '51-60': {M: 6000, F: 7480}, '61-65': {M: 8640, F: 10390} },
    'MEDNET_EMERALD_10': { '0-5': {M: 2790, F: 2790}, '6-17': {M: 1872, F: 1872}, '18-30': {M: 2115, F: 3510}, '31-40': {M: 2790, F: 4419}, '41-50': {M: 3762, F: 5094}, '51-60': {M: 5400, F: 6732}, '61-65': {M: 7776, F: 9351} },
    'MEDNET_EMERALD_20': { '0-5': {M: 2480, F: 2480}, '6-17': {M: 1664, F: 1664}, '18-30': {M: 1880, F: 3120}, '31-40': {M: 2480, F: 3928}, '41-50': {M: 3344, F: 4528}, '51-60': {M: 4800, F: 5984}, '61-65': {M: 6912, F: 8312} },
    'MEDNET_GREEN_0': { '0-5': {M: 3700, F: 3700}, '6-17': {M: 2480, F: 2480}, '18-30': {M: 2800, F: 4650}, '31-40': {M: 3700, F: 5860}, '41-50': {M: 4980, F: 6770}, '51-60': {M: 7160, F: 8920}, '61-65': {M: 10300, F: 12400} },
    'MEDNET_GREEN_10': { '0-5': {M: 3330, F: 3330}, '6-17': {M: 2232, F: 2232}, '18-30': {M: 2520, F: 4185}, '31-40': {M: 3330, F: 5274}, '41-50': {M: 4482, F: 6093}, '51-60': {M: 6444, F: 8028}, '61-65': {M: 9270, F: 11160} },
    'MEDNET_GREEN_20': { '0-5': {M: 2960, F: 2960}, '6-17': {M: 1984, F: 1984}, '18-30': {M: 2240, F: 3720}, '31-40': {M: 2960, F: 4688}, '41-50': {M: 3984, F: 5416}, '51-60': {M: 5728, F: 7136}, '61-65': {M: 8240, F: 9920} },
    'MEDNET_SILVER_CLASSIC_0': { '0-5': {M: 4300, F: 4300}, '6-17': {M: 2880, F: 2880}, '18-30': {M: 3250, F: 5400}, '31-40': {M: 4300, F: 6810}, '41-50': {M: 5790, F: 7870}, '51-60': {M: 8310, F: 10370}, '61-65': {M: 11970, F: 14400} },
    'MEDNET_SILVER_CLASSIC_10': { '0-5': {M: 3870, F: 3870}, '6-17': {M: 2592, F: 2592}, '18-30': {M: 2925, F: 4860}, '31-40': {M: 3870, F: 6129}, '41-50': {M: 5211, F: 7083}, '51-60': {M: 7479, F: 9333}, '61-65': {M: 10773, F: 12960} },
    'MEDNET_SILVER_CLASSIC_20': { '0-5': {M: 3440, F: 3440}, '6-17': {M: 2304, F: 2304}, '18-30': {M: 2600, F: 4320}, '31-40': {M: 3440, F: 5448}, '41-50': {M: 4632, F: 6296}, '51-60': {M: 6648, F: 8296}, '61-65': {M: 9576, F: 11520} },
    'MEDNET_SILVER_PREMIUM_0': { '0-5': {M: 4900, F: 4900}, '6-17': {M: 3280, F: 3280}, '18-30': {M: 3700, F: 6150}, '31-40': {M: 4900, F: 7760}, '41-50': {M: 6590, F: 8970}, '51-60': {M: 9470, F: 11810}, '61-65': {M: 13630, F: 16400} },
    'MEDNET_SILVER_PREMIUM_10': { '0-5': {M: 4410, F: 4410}, '6-17': {M: 2952, F: 2952}, '18-30': {M: 3330, F: 5535}, '31-40': {M: 4410, F: 6984}, '41-50': {M: 5931, F: 8073}, '51-60': {M: 8523, F: 10629}, '61-65': {M: 12267, F: 14760} },
    'MEDNET_SILVER_PREMIUM_20': { '0-5': {M: 3920, F: 3920}, '6-17': {M: 2624, F: 2624}, '18-30': {M: 2960, F: 4920}, '31-40': {M: 3920, F: 6208}, '41-50': {M: 5272, F: 7176}, '51-60': {M: 7576, F: 9448}, '61-65': {M: 10904, F: 13120} },
    'MEDNET_GOLD_0': { '0-5': {M: 5500, F: 5500}, '6-17': {M: 3680, F: 3680}, '18-30': {M: 4150, F: 6900}, '31-40': {M: 5500, F: 8710}, '41-50': {M: 7400, F: 10070}, '51-60': {M: 10630, F: 13280}, '61-65': {M: 15300, F: 18410} },
    'MEDNET_GOLD_10': { '0-5': {M: 4950, F: 4950}, '6-17': {M: 3312, F: 3312}, '18-30': {M: 3735, F: 6210}, '31-40': {M: 4950, F: 7839}, '41-50': {M: 6660, F: 9063}, '51-60': {M: 9567, F: 11952}, '61-65': {M: 13770, F: 16569} },
    'MEDNET_GOLD_20': { '0-5': {M: 4400, F: 4400}, '6-17': {M: 2944, F: 2944}, '18-30': {M: 3320, F: 5520}, '31-40': {M: 4400, F: 6968}, '41-50': {M: 5920, F: 8056}, '51-60': {M: 8504, F: 10624}, '61-65': {M: 12240, F: 14728} }
  },
  // QATAR INSURANCE MEDNET Plans
  'QATAR_INSURANCE_MEDNET': {
    'MEDNET_SILKROAD_0': { '0-5': {M: 2000, F: 2000}, '6-17': {M: 1350, F: 1350}, '18-30': {M: 1530, F: 2530}, '31-40': {M: 2000, F: 3170}, '41-50': {M: 2700, F: 3650}, '51-60': {M: 3880, F: 4830}, '61-65': {M: 5580, F: 6710} },
    'MEDNET_SILKROAD_10': { '0-5': {M: 1800, F: 1800}, '6-17': {M: 1215, F: 1215}, '18-30': {M: 1377, F: 2277}, '31-40': {M: 1800, F: 2853}, '41-50': {M: 2430, F: 3285}, '51-60': {M: 3492, F: 4347}, '61-65': {M: 5022, F: 6039} },
    'MEDNET_SILKROAD_20': { '0-5': {M: 1600, F: 1600}, '6-17': {M: 1080, F: 1080}, '18-30': {M: 1224, F: 2024}, '31-40': {M: 1600, F: 2536}, '41-50': {M: 2160, F: 2920}, '51-60': {M: 3104, F: 3864}, '61-65': {M: 4464, F: 5368} },
    'MEDNET_PEARL_0': { '0-5': {M: 2600, F: 2600}, '6-17': {M: 1750, F: 1750}, '18-30': {M: 1980, F: 3280}, '31-40': {M: 2600, F: 4120}, '41-50': {M: 3500, F: 4750}, '51-60': {M: 5030, F: 6270}, '61-65': {M: 7240, F: 8710} },
    'MEDNET_PEARL_10': { '0-5': {M: 2340, F: 2340}, '6-17': {M: 1575, F: 1575}, '18-30': {M: 1782, F: 2952}, '31-40': {M: 2340, F: 3708}, '41-50': {M: 3150, F: 4275}, '51-60': {M: 4527, F: 5643}, '61-65': {M: 6516, F: 7839} },
    'MEDNET_PEARL_20': { '0-5': {M: 2080, F: 2080}, '6-17': {M: 1400, F: 1400}, '18-30': {M: 1584, F: 2624}, '31-40': {M: 2080, F: 3296}, '41-50': {M: 2800, F: 3800}, '51-60': {M: 4024, F: 5016}, '61-65': {M: 5792, F: 6968} },
    'MEDNET_EMERALD_0': { '0-5': {M: 3200, F: 3200}, '6-17': {M: 2150, F: 2150}, '18-30': {M: 2430, F: 4030}, '31-40': {M: 3200, F: 5070}, '41-50': {M: 4310, F: 5850}, '51-60': {M: 6190, F: 7720}, '61-65': {M: 8910, F: 10720} },
    'MEDNET_EMERALD_10': { '0-5': {M: 2880, F: 2880}, '6-17': {M: 1935, F: 1935}, '18-30': {M: 2187, F: 3627}, '31-40': {M: 2880, F: 4563}, '41-50': {M: 3879, F: 5265}, '51-60': {M: 5571, F: 6948}, '61-65': {M: 8019, F: 9648} },
    'MEDNET_EMERALD_20': { '0-5': {M: 2560, F: 2560}, '6-17': {M: 1720, F: 1720}, '18-30': {M: 1944, F: 3224}, '31-40': {M: 2560, F: 4056}, '41-50': {M: 3448, F: 4680}, '51-60': {M: 4952, F: 6176}, '61-65': {M: 7128, F: 8576} },
    'MEDNET_GREEN_0': { '0-5': {M: 3800, F: 3800}, '6-17': {M: 2550, F: 2550}, '18-30': {M: 2880, F: 4780}, '31-40': {M: 3800, F: 6020}, '41-50': {M: 5120, F: 6950}, '51-60': {M: 7350, F: 9170}, '61-65': {M: 10580, F: 12740} },
    'MEDNET_GREEN_10': { '0-5': {M: 3420, F: 3420}, '6-17': {M: 2295, F: 2295}, '18-30': {M: 2592, F: 4302}, '31-40': {M: 3420, F: 5418}, '41-50': {M: 4608, F: 6255}, '51-60': {M: 6615, F: 8253}, '61-65': {M: 9522, F: 11466} },
    'MEDNET_GREEN_20': { '0-5': {M: 3040, F: 3040}, '6-17': {M: 2040, F: 2040}, '18-30': {M: 2304, F: 3824}, '31-40': {M: 3040, F: 4816}, '41-50': {M: 4096, F: 5560}, '51-60': {M: 5880, F: 7336}, '61-65': {M: 8464, F: 10192} },
    'MEDNET_SILVER_CLASSIC_0': { '0-5': {M: 4400, F: 4400}, '6-17': {M: 2950, F: 2950}, '18-30': {M: 3330, F: 5530}, '31-40': {M: 4400, F: 6970}, '41-50': {M: 5920, F: 8050}, '51-60': {M: 8500, F: 10610}, '61-65': {M: 12240, F: 14730} },
    'MEDNET_SILVER_CLASSIC_10': { '0-5': {M: 3960, F: 3960}, '6-17': {M: 2655, F: 2655}, '18-30': {M: 2997, F: 4977}, '31-40': {M: 3960, F: 6273}, '41-50': {M: 5328, F: 7245}, '51-60': {M: 7650, F: 9549}, '61-65': {M: 11016, F: 13257} },
    'MEDNET_SILVER_CLASSIC_20': { '0-5': {M: 3520, F: 3520}, '6-17': {M: 2360, F: 2360}, '18-30': {M: 2664, F: 4424}, '31-40': {M: 3520, F: 5576}, '41-50': {M: 4736, F: 6440}, '51-60': {M: 6800, F: 8488}, '61-65': {M: 9792, F: 11784} },
    'MEDNET_SILVER_PREMIUM_0': { '0-5': {M: 5000, F: 5000}, '6-17': {M: 3350, F: 3350}, '18-30': {M: 3780, F: 6280}, '31-40': {M: 5000, F: 7920}, '41-50': {M: 6730, F: 9150}, '51-60': {M: 9670, F: 12060}, '61-65': {M: 13910, F: 16740} },
    'MEDNET_SILVER_PREMIUM_10': { '0-5': {M: 4500, F: 4500}, '6-17': {M: 3015, F: 3015}, '18-30': {M: 3402, F: 5652}, '31-40': {M: 4500, F: 7128}, '41-50': {M: 6057, F: 8235}, '51-60': {M: 8703, F: 10854}, '61-65': {M: 12519, F: 15066} },
    'MEDNET_SILVER_PREMIUM_20': { '0-5': {M: 4000, F: 4000}, '6-17': {M: 2680, F: 2680}, '18-30': {M: 3024, F: 5024}, '31-40': {M: 4000, F: 6336}, '41-50': {M: 5384, F: 7320}, '51-60': {M: 7736, F: 9648}, '61-65': {M: 11128, F: 13392} },
    'MEDNET_GOLD_0': { '0-5': {M: 5600, F: 5600}, '6-17': {M: 3750, F: 3750}, '18-30': {M: 4230, F: 7030}, '31-40': {M: 5600, F: 8870}, '41-50': {M: 7530, F: 10250}, '51-60': {M: 10820, F: 13520}, '61-65': {M: 15570, F: 18740} },
    'MEDNET_GOLD_10': { '0-5': {M: 5040, F: 5040}, '6-17': {M: 3375, F: 3375}, '18-30': {M: 3807, F: 6327}, '31-40': {M: 5040, F: 7983}, '41-50': {M: 6777, F: 9225}, '51-60': {M: 9738, F: 12168}, '61-65': {M: 14013, F: 16866} },
    'MEDNET_GOLD_20': { '0-5': {M: 4480, F: 4480}, '6-17': {M: 3000, F: 3000}, '18-30': {M: 3384, F: 5624}, '31-40': {M: 4480, F: 7096}, '41-50': {M: 6024, F: 8200}, '51-60': {M: 8656, F: 10816}, '61-65': {M: 12456, F: 14992} }
  },
  // TAKAFUL EMARAT NEXTCARE Plans
  'TAKAFUL_EMARAT_NEXTCARE': {
    'NEXTCARE_PCP_0': { '0-5': {M: 1800, F: 1800}, '6-17': {M: 1200, F: 1200}, '18-30': {M: 1350, F: 2250}, '31-40': {M: 1800, F: 2850}, '41-50': {M: 2400, F: 3250}, '51-60': {M: 3450, F: 4300}, '61-65': {M: 4950, F: 5950} },
    'NEXTCARE_PCP_10': { '0-5': {M: 1620, F: 1620}, '6-17': {M: 1080, F: 1080}, '18-30': {M: 1215, F: 2025}, '31-40': {M: 1620, F: 2565}, '41-50': {M: 2160, F: 2925}, '51-60': {M: 3105, F: 3870}, '61-65': {M: 4455, F: 5355} },
    'NEXTCARE_PCP_20': { '0-5': {M: 1440, F: 1440}, '6-17': {M: 960, F: 960}, '18-30': {M: 1080, F: 1800}, '31-40': {M: 1440, F: 2280}, '41-50': {M: 1920, F: 2600}, '51-60': {M: 2760, F: 3440}, '61-65': {M: 3960, F: 4760} },
    'NEXTCARE_RN3_0': { '0-5': {M: 2100, F: 2100}, '6-17': {M: 1400, F: 1400}, '18-30': {M: 1580, F: 2620}, '31-40': {M: 2100, F: 3330}, '41-50': {M: 2800, F: 3800}, '51-60': {M: 4020, F: 5010}, '61-65': {M: 5780, F: 6950} },
    'NEXTCARE_RN3_10': { '0-5': {M: 1890, F: 1890}, '6-17': {M: 1260, F: 1260}, '18-30': {M: 1422, F: 2358}, '31-40': {M: 1890, F: 2997}, '41-50': {M: 2520, F: 3420}, '51-60': {M: 3618, F: 4509}, '61-65': {M: 5202, F: 6255} },
    'NEXTCARE_RN3_20': { '0-5': {M: 1680, F: 1680}, '6-17': {M: 1120, F: 1120}, '18-30': {M: 1264, F: 2096}, '31-40': {M: 1680, F: 2664}, '41-50': {M: 2240, F: 3040}, '51-60': {M: 3216, F: 4008}, '61-65': {M: 4624, F: 5560} },
    'NEXTCARE_RN2_0': { '0-5': {M: 2400, F: 2400}, '6-17': {M: 1600, F: 1600}, '18-30': {M: 1800, F: 3000}, '31-40': {M: 2400, F: 3800}, '41-50': {M: 3200, F: 4350}, '51-60': {M: 4600, F: 5730}, '61-65': {M: 6610, F: 7950} },
    'NEXTCARE_RN2_10': { '0-5': {M: 2160, F: 2160}, '6-17': {M: 1440, F: 1440}, '18-30': {M: 1620, F: 2700}, '31-40': {M: 2160, F: 3420}, '41-50': {M: 2880, F: 3915}, '51-60': {M: 4140, F: 5157}, '61-65': {M: 5949, F: 7155} },
    'NEXTCARE_RN2_20': { '0-5': {M: 1920, F: 1920}, '6-17': {M: 1280, F: 1280}, '18-30': {M: 1440, F: 2400}, '31-40': {M: 1920, F: 3040}, '41-50': {M: 2560, F: 3480}, '51-60': {M: 3680, F: 4584}, '61-65': {M: 5288, F: 6360} },
    'NEXTCARE_RN_0': { '0-5': {M: 2700, F: 2700}, '6-17': {M: 1800, F: 1800}, '18-30': {M: 2030, F: 3370}, '31-40': {M: 2700, F: 4280}, '41-50': {M: 3600, F: 4890}, '51-60': {M: 5170, F: 6450}, '61-65': {M: 7440, F: 8950} },
    'NEXTCARE_RN_10': { '0-5': {M: 2430, F: 2430}, '6-17': {M: 1620, F: 1620}, '18-30': {M: 1827, F: 3033}, '31-40': {M: 2430, F: 3852}, '41-50': {M: 3240, F: 4401}, '51-60': {M: 4653, F: 5805}, '61-65': {M: 6696, F: 8055} },
    'NEXTCARE_RN_20': { '0-5': {M: 2160, F: 2160}, '6-17': {M: 1440, F: 1440}, '18-30': {M: 1624, F: 2696}, '31-40': {M: 2160, F: 3424}, '41-50': {M: 2880, F: 3912}, '51-60': {M: 4136, F: 5160}, '61-65': {M: 5952, F: 7160} },
    'NEXTCARE_GN_LIMITED_0': { '0-5': {M: 3000, F: 3000}, '6-17': {M: 2000, F: 2000}, '18-30': {M: 2250, F: 3740}, '31-40': {M: 3000, F: 4750}, '41-50': {M: 4000, F: 5430}, '51-60': {M: 5750, F: 7160}, '61-65': {M: 8270, F: 9940} },
    'NEXTCARE_GN_LIMITED_10': { '0-5': {M: 2700, F: 2700}, '6-17': {M: 1800, F: 1800}, '18-30': {M: 2025, F: 3366}, '31-40': {M: 2700, F: 4275}, '41-50': {M: 3600, F: 4887}, '51-60': {M: 5175, F: 6444}, '61-65': {M: 7443, F: 8946} },
    'NEXTCARE_GN_LIMITED_20': { '0-5': {M: 2400, F: 2400}, '6-17': {M: 1600, F: 1600}, '18-30': {M: 1800, F: 2992}, '31-40': {M: 2400, F: 3800}, '41-50': {M: 3200, F: 4344}, '51-60': {M: 4600, F: 5728}, '61-65': {M: 6616, F: 7952} },
    'NEXTCARE_GN_0': { '0-5': {M: 3300, F: 3300}, '6-17': {M: 2200, F: 2200}, '18-30': {M: 2480, F: 4110}, '31-40': {M: 3300, F: 5230}, '41-50': {M: 4400, F: 5980}, '51-60': {M: 6320, F: 7880}, '61-65': {M: 9090, F: 10940} },
    'NEXTCARE_GN_10': { '0-5': {M: 2970, F: 2970}, '6-17': {M: 1980, F: 1980}, '18-30': {M: 2232, F: 3699}, '31-40': {M: 2970, F: 4707}, '41-50': {M: 3960, F: 5382}, '51-60': {M: 5688, F: 7092}, '61-65': {M: 8181, F: 9846} },
    'NEXTCARE_GN_20': { '0-5': {M: 2640, F: 2640}, '6-17': {M: 1760, F: 1760}, '18-30': {M: 1984, F: 3288}, '31-40': {M: 2640, F: 4184}, '41-50': {M: 3520, F: 4784}, '51-60': {M: 5056, F: 6304}, '61-65': {M: 7272, F: 8752} },
    'NEXTCARE_GN_PLUS_0': { '0-5': {M: 3600, F: 3600}, '6-17': {M: 2400, F: 2400}, '18-30': {M: 2700, F: 4490}, '31-40': {M: 3600, F: 5710}, '41-50': {M: 4800, F: 6520}, '51-60': {M: 6900, F: 8600}, '61-65': {M: 9920, F: 11940} },
    'NEXTCARE_GN_PLUS_10': { '0-5': {M: 3240, F: 3240}, '6-17': {M: 2160, F: 2160}, '18-30': {M: 2430, F: 4041}, '31-40': {M: 3240, F: 5139}, '41-50': {M: 4320, F: 5868}, '51-60': {M: 6210, F: 7740}, '61-65': {M: 8928, F: 10746} },
    'NEXTCARE_GN_PLUS_20': { '0-5': {M: 2880, F: 2880}, '6-17': {M: 1920, F: 1920}, '18-30': {M: 2160, F: 3592}, '31-40': {M: 2880, F: 4568}, '41-50': {M: 3840, F: 5216}, '51-60': {M: 5520, F: 6880}, '61-65': {M: 7936, F: 9552} }
  },
  // ORIENT NEXTCARE Plans
  'ORIENT_NEXTCARE': {
    'NEXTCARE_PCP_0': { '0-5': {M: 1750, F: 1750}, '6-17': {M: 1170, F: 1170}, '18-30': {M: 1320, F: 2190}, '31-40': {M: 1750, F: 2770}, '41-50': {M: 2340, F: 3170}, '51-60': {M: 3360, F: 4190}, '61-65': {M: 4830, F: 5810} },
    'NEXTCARE_PCP_10': { '0-5': {M: 1575, F: 1575}, '6-17': {M: 1053, F: 1053}, '18-30': {M: 1188, F: 1971}, '31-40': {M: 1575, F: 2493}, '41-50': {M: 2106, F: 2853}, '51-60': {M: 3024, F: 3771}, '61-65': {M: 4347, F: 5229} },
    'NEXTCARE_PCP_20': { '0-5': {M: 1400, F: 1400}, '6-17': {M: 936, F: 936}, '18-30': {M: 1056, F: 1752}, '31-40': {M: 1400, F: 2216}, '41-50': {M: 1872, F: 2536}, '51-60': {M: 2688, F: 3352}, '61-65': {M: 3864, F: 4648} },
    'NEXTCARE_RN3_0': { '0-5': {M: 2050, F: 2050}, '6-17': {M: 1370, F: 1370}, '18-30': {M: 1540, F: 2560}, '31-40': {M: 2050, F: 3250}, '41-50': {M: 2730, F: 3710}, '51-60': {M: 3930, F: 4890}, '61-65': {M: 5650, F: 6790} },
    'NEXTCARE_RN3_10': { '0-5': {M: 1845, F: 1845}, '6-17': {M: 1233, F: 1233}, '18-30': {M: 1386, F: 2304}, '31-40': {M: 1845, F: 2925}, '41-50': {M: 2457, F: 3339}, '51-60': {M: 3537, F: 4401}, '61-65': {M: 5085, F: 6111} },
    'NEXTCARE_RN3_20': { '0-5': {M: 1640, F: 1640}, '6-17': {M: 1096, F: 1096}, '18-30': {M: 1232, F: 2048}, '31-40': {M: 1640, F: 2600}, '41-50': {M: 2184, F: 2968}, '51-60': {M: 3144, F: 3912}, '61-65': {M: 4520, F: 5432} },
    'NEXTCARE_RN2_0': { '0-5': {M: 2350, F: 2350}, '6-17': {M: 1570, F: 1570}, '18-30': {M: 1770, F: 2940}, '31-40': {M: 2350, F: 3720}, '41-50': {M: 3130, F: 4250}, '51-60': {M: 4500, F: 5610}, '61-65': {M: 6470, F: 7780} },
    'NEXTCARE_RN2_10': { '0-5': {M: 2115, F: 2115}, '6-17': {M: 1413, F: 1413}, '18-30': {M: 1593, F: 2646}, '31-40': {M: 2115, F: 3348}, '41-50': {M: 2817, F: 3825}, '51-60': {M: 4050, F: 5049}, '61-65': {M: 5823, F: 7002} },
    'NEXTCARE_RN2_20': { '0-5': {M: 1880, F: 1880}, '6-17': {M: 1256, F: 1256}, '18-30': {M: 1416, F: 2352}, '31-40': {M: 1880, F: 2976}, '41-50': {M: 2504, F: 3400}, '51-60': {M: 3600, F: 4488}, '61-65': {M: 5176, F: 6224} },
    'NEXTCARE_RN_0': { '0-5': {M: 2650, F: 2650}, '6-17': {M: 1770, F: 1770}, '18-30': {M: 1990, F: 3310}, '31-40': {M: 2650, F: 4200}, '41-50': {M: 3530, F: 4800}, '51-60': {M: 5080, F: 6330}, '61-65': {M: 7300, F: 8780} },
    'NEXTCARE_RN_10': { '0-5': {M: 2385, F: 2385}, '6-17': {M: 1593, F: 1593}, '18-30': {M: 1791, F: 2979}, '31-40': {M: 2385, F: 3780}, '41-50': {M: 3177, F: 4320}, '51-60': {M: 4572, F: 5697}, '61-65': {M: 6570, F: 7902} },
    'NEXTCARE_RN_20': { '0-5': {M: 2120, F: 2120}, '6-17': {M: 1416, F: 1416}, '18-30': {M: 1592, F: 2648}, '31-40': {M: 2120, F: 3360}, '41-50': {M: 2824, F: 3840}, '51-60': {M: 4064, F: 5064}, '61-65': {M: 5840, F: 7024} },
    'NEXTCARE_GN_LIMITED_0': { '0-5': {M: 2950, F: 2950}, '6-17': {M: 1970, F: 1970}, '18-30': {M: 2220, F: 3680}, '31-40': {M: 2950, F: 4670}, '41-50': {M: 3930, F: 5340}, '51-60': {M: 5650, F: 7040}, '61-65': {M: 8130, F: 9770} },
    'NEXTCARE_GN_LIMITED_10': { '0-5': {M: 2655, F: 2655}, '6-17': {M: 1773, F: 1773}, '18-30': {M: 1998, F: 3312}, '31-40': {M: 2655, F: 4203}, '41-50': {M: 3537, F: 4806}, '51-60': {M: 5085, F: 6336}, '61-65': {M: 7317, F: 8793} },
    'NEXTCARE_GN_LIMITED_20': { '0-5': {M: 2360, F: 2360}, '6-17': {M: 1576, F: 1576}, '18-30': {M: 1776, F: 2944}, '31-40': {M: 2360, F: 3736}, '41-50': {M: 3144, F: 4272}, '51-60': {M: 4520, F: 5632}, '61-65': {M: 6504, F: 7816} },
    'NEXTCARE_GN_0': { '0-5': {M: 3250, F: 3250}, '6-17': {M: 2170, F: 2170}, '18-30': {M: 2440, F: 4050}, '31-40': {M: 3250, F: 5150}, '41-50': {M: 4330, F: 5880}, '51-60': {M: 6220, F: 7760}, '61-65': {M: 8950, F: 10760} },
    'NEXTCARE_GN_10': { '0-5': {M: 2925, F: 2925}, '6-17': {M: 1953, F: 1953}, '18-30': {M: 2196, F: 3645}, '31-40': {M: 2925, F: 4635}, '41-50': {M: 3897, F: 5292}, '51-60': {M: 5598, F: 6984}, '61-65': {M: 8055, F: 9684} },
    'NEXTCARE_GN_20': { '0-5': {M: 2600, F: 2600}, '6-17': {M: 1736, F: 1736}, '18-30': {M: 1952, F: 3240}, '31-40': {M: 2600, F: 4120}, '41-50': {M: 3464, F: 4704}, '51-60': {M: 4976, F: 6208}, '61-65': {M: 7160, F: 8608} },
    'NEXTCARE_GN_PLUS_0': { '0-5': {M: 3550, F: 3550}, '6-17': {M: 2370, F: 2370}, '18-30': {M: 2670, F: 4430}, '31-40': {M: 3550, F: 5630}, '41-50': {M: 4730, F: 6430}, '51-60': {M: 6800, F: 8480}, '61-65': {M: 9780, F: 11770} },
    'NEXTCARE_GN_PLUS_10': { '0-5': {M: 3195, F: 3195}, '6-17': {M: 2133, F: 2133}, '18-30': {M: 2403, F: 3987}, '31-40': {M: 3195, F: 5067}, '41-50': {M: 4257, F: 5787}, '51-60': {M: 6120, F: 7632}, '61-65': {M: 8802, F: 10593} },
    'NEXTCARE_GN_PLUS_20': { '0-5': {M: 2840, F: 2840}, '6-17': {M: 1896, F: 1896}, '18-30': {M: 2136, F: 3544}, '31-40': {M: 2840, F: 4504}, '41-50': {M: 3784, F: 5144}, '51-60': {M: 5440, F: 6784}, '61-65': {M: 7824, F: 9416} }
  },
  // FIDELITY NEXTCARE Plans
  'FIDELITY_NEXTCARE': {
    'NEXTCARE_PCP_0': { '0-5': {M: 1900, F: 1900}, '6-17': {M: 1270, F: 1270}, '18-30': {M: 1430, F: 2370}, '31-40': {M: 1900, F: 3010}, '41-50': {M: 2530, F: 3440}, '51-60': {M: 3640, F: 4540}, '61-65': {M: 5240, F: 6300} },
    'NEXTCARE_PCP_10': { '0-5': {M: 1710, F: 1710}, '6-17': {M: 1143, F: 1143}, '18-30': {M: 1287, F: 2133}, '31-40': {M: 1710, F: 2709}, '41-50': {M: 2277, F: 3096}, '51-60': {M: 3276, F: 4086}, '61-65': {M: 4716, F: 5670} },
    'NEXTCARE_PCP_20': { '0-5': {M: 1520, F: 1520}, '6-17': {M: 1016, F: 1016}, '18-30': {M: 1144, F: 1896}, '31-40': {M: 1520, F: 2408}, '41-50': {M: 2024, F: 2752}, '51-60': {M: 2912, F: 3632}, '61-65': {M: 4192, F: 5040} },
    'NEXTCARE_RN3_0': { '0-5': {M: 2200, F: 2200}, '6-17': {M: 1470, F: 1470}, '18-30': {M: 1650, F: 2740}, '31-40': {M: 2200, F: 3480}, '41-50': {M: 2930, F: 3980}, '51-60': {M: 4210, F: 5250}, '61-65': {M: 6060, F: 7280} },
    'NEXTCARE_RN3_10': { '0-5': {M: 1980, F: 1980}, '6-17': {M: 1323, F: 1323}, '18-30': {M: 1485, F: 2466}, '31-40': {M: 1980, F: 3132}, '41-50': {M: 2637, F: 3582}, '51-60': {M: 3789, F: 4725}, '61-65': {M: 5454, F: 6552} },
    'NEXTCARE_RN3_20': { '0-5': {M: 1760, F: 1760}, '6-17': {M: 1176, F: 1176}, '18-30': {M: 1320, F: 2192}, '31-40': {M: 1760, F: 2784}, '41-50': {M: 2344, F: 3184}, '51-60': {M: 3368, F: 4200}, '61-65': {M: 4848, F: 5824} },
    'NEXTCARE_RN2_0': { '0-5': {M: 2500, F: 2500}, '6-17': {M: 1670, F: 1670}, '18-30': {M: 1880, F: 3120}, '31-40': {M: 2500, F: 3960}, '41-50': {M: 3330, F: 4530}, '51-60': {M: 4790, F: 5970}, '61-65': {M: 6890, F: 8280} },
    'NEXTCARE_RN2_10': { '0-5': {M: 2250, F: 2250}, '6-17': {M: 1503, F: 1503}, '18-30': {M: 1692, F: 2808}, '31-40': {M: 2250, F: 3564}, '41-50': {M: 2997, F: 4077}, '51-60': {M: 4311, F: 5373}, '61-65': {M: 6201, F: 7452} },
    'NEXTCARE_RN2_20': { '0-5': {M: 2000, F: 2000}, '6-17': {M: 1336, F: 1336}, '18-30': {M: 1504, F: 2496}, '31-40': {M: 2000, F: 3168}, '41-50': {M: 2664, F: 3624}, '51-60': {M: 3832, F: 4776}, '61-65': {M: 5512, F: 6624} },
    'NEXTCARE_RN_0': { '0-5': {M: 2800, F: 2800}, '6-17': {M: 1870, F: 1870}, '18-30': {M: 2100, F: 3490}, '31-40': {M: 2800, F: 4440}, '41-50': {M: 3730, F: 5070}, '51-60': {M: 5360, F: 6690}, '61-65': {M: 7710, F: 9270} },
    'NEXTCARE_RN_10': { '0-5': {M: 2520, F: 2520}, '6-17': {M: 1683, F: 1683}, '18-30': {M: 1890, F: 3141}, '31-40': {M: 2520, F: 3996}, '41-50': {M: 3357, F: 4563}, '51-60': {M: 4824, F: 6021}, '61-65': {M: 6939, F: 8343} },
    'NEXTCARE_RN_20': { '0-5': {M: 2240, F: 2240}, '6-17': {M: 1496, F: 1496}, '18-30': {M: 1680, F: 2792}, '31-40': {M: 2240, F: 3552}, '41-50': {M: 2984, F: 4056}, '51-60': {M: 4288, F: 5352}, '61-65': {M: 6168, F: 7416} },
    'NEXTCARE_GN_LIMITED_0': { '0-5': {M: 3100, F: 3100}, '6-17': {M: 2070, F: 2070}, '18-30': {M: 2330, F: 3870}, '31-40': {M: 3100, F: 4910}, '41-50': {M: 4130, F: 5610}, '51-60': {M: 5940, F: 7400}, '61-65': {M: 8540, F: 10270} },
    'NEXTCARE_GN_LIMITED_10': { '0-5': {M: 2790, F: 2790}, '6-17': {M: 1863, F: 1863}, '18-30': {M: 2097, F: 3483}, '31-40': {M: 2790, F: 4419}, '41-50': {M: 3717, F: 5049}, '51-60': {M: 5346, F: 6660}, '61-65': {M: 7686, F: 9243} },
    'NEXTCARE_GN_LIMITED_20': { '0-5': {M: 2480, F: 2480}, '6-17': {M: 1656, F: 1656}, '18-30': {M: 1864, F: 3096}, '31-40': {M: 2480, F: 3928}, '41-50': {M: 3304, F: 4488}, '51-60': {M: 4752, F: 5920}, '61-65': {M: 6832, F: 8216} },
    'NEXTCARE_GN_0': { '0-5': {M: 3400, F: 3400}, '6-17': {M: 2270, F: 2270}, '18-30': {M: 2560, F: 4250}, '31-40': {M: 3400, F: 5390}, '41-50': {M: 4530, F: 6160}, '51-60': {M: 6520, F: 8120}, '61-65': {M: 9370, F: 11270} },
    'NEXTCARE_GN_10': { '0-5': {M: 3060, F: 3060}, '6-17': {M: 2043, F: 2043}, '18-30': {M: 2304, F: 3825}, '31-40': {M: 3060, F: 4851}, '41-50': {M: 4077, F: 5544}, '51-60': {M: 5868, F: 7308}, '61-65': {M: 8433, F: 10143} },
    'NEXTCARE_GN_20': { '0-5': {M: 2720, F: 2720}, '6-17': {M: 1816, F: 1816}, '18-30': {M: 2048, F: 3400}, '31-40': {M: 2720, F: 4312}, '41-50': {M: 3624, F: 4928}, '51-60': {M: 5216, F: 6496}, '61-65': {M: 7496, F: 9016} },
    'NEXTCARE_GN_PLUS_0': { '0-5': {M: 3700, F: 3700}, '6-17': {M: 2470, F: 2470}, '18-30': {M: 2780, F: 4620}, '31-40': {M: 3700, F: 5870}, '41-50': {M: 4930, F: 6700}, '51-60': {M: 7090, F: 8840}, '61-65': {M: 10200, F: 12270} },
    'NEXTCARE_GN_PLUS_10': { '0-5': {M: 3330, F: 3330}, '6-17': {M: 2223, F: 2223}, '18-30': {M: 2502, F: 4158}, '31-40': {M: 3330, F: 5283}, '41-50': {M: 4437, F: 6030}, '51-60': {M: 6381, F: 7956}, '61-65': {M: 9180, F: 11043} },
    'NEXTCARE_GN_PLUS_20': { '0-5': {M: 2960, F: 2960}, '6-17': {M: 1976, F: 1976}, '18-30': {M: 2224, F: 3696}, '31-40': {M: 2960, F: 4696}, '41-50': {M: 3944, F: 5360}, '51-60': {M: 5672, F: 7072}, '61-65': {M: 8160, F: 9816} }
  },
  // AL SAGR NEXTCARE Plans
  'ALSAGR_NEXTCARE': {
    'NEXTCARE_PCP_0': { '0-5': {M: 1850, F: 1850}, '6-17': {M: 1240, F: 1240}, '18-30': {M: 1390, F: 2310}, '31-40': {M: 1850, F: 2930}, '41-50': {M: 2470, F: 3350}, '51-60': {M: 3550, F: 4420}, '61-65': {M: 5100, F: 6140} },
    'NEXTCARE_PCP_10': { '0-5': {M: 1665, F: 1665}, '6-17': {M: 1116, F: 1116}, '18-30': {M: 1251, F: 2079}, '31-40': {M: 1665, F: 2637}, '41-50': {M: 2223, F: 3015}, '51-60': {M: 3195, F: 3978}, '61-65': {M: 4590, F: 5526} },
    'NEXTCARE_PCP_20': { '0-5': {M: 1480, F: 1480}, '6-17': {M: 992, F: 992}, '18-30': {M: 1112, F: 1848}, '31-40': {M: 1480, F: 2344}, '41-50': {M: 1976, F: 2680}, '51-60': {M: 2840, F: 3536}, '61-65': {M: 4080, F: 4912} },
    'NEXTCARE_RN3_0': { '0-5': {M: 2150, F: 2150}, '6-17': {M: 1440, F: 1440}, '18-30': {M: 1620, F: 2690}, '31-40': {M: 2150, F: 3410}, '41-50': {M: 2870, F: 3900}, '51-60': {M: 4120, F: 5140}, '61-65': {M: 5930, F: 7130} },
    'NEXTCARE_RN3_10': { '0-5': {M: 1935, F: 1935}, '6-17': {M: 1296, F: 1296}, '18-30': {M: 1458, F: 2421}, '31-40': {M: 1935, F: 3069}, '41-50': {M: 2583, F: 3510}, '51-60': {M: 3708, F: 4626}, '61-65': {M: 5337, F: 6417} },
    'NEXTCARE_RN3_20': { '0-5': {M: 1720, F: 1720}, '6-17': {M: 1152, F: 1152}, '18-30': {M: 1296, F: 2152}, '31-40': {M: 1720, F: 2728}, '41-50': {M: 2296, F: 3120}, '51-60': {M: 3296, F: 4112}, '61-65': {M: 4744, F: 5704} },
    'NEXTCARE_RN2_0': { '0-5': {M: 2450, F: 2450}, '6-17': {M: 1640, F: 1640}, '18-30': {M: 1840, F: 3060}, '31-40': {M: 2450, F: 3880}, '41-50': {M: 3270, F: 4440}, '51-60': {M: 4700, F: 5850}, '61-65': {M: 6760, F: 8120} },
    'NEXTCARE_RN2_10': { '0-5': {M: 2205, F: 2205}, '6-17': {M: 1476, F: 1476}, '18-30': {M: 1656, F: 2754}, '31-40': {M: 2205, F: 3492}, '41-50': {M: 2943, F: 3996}, '51-60': {M: 4230, F: 5265}, '61-65': {M: 6084, F: 7308} },
    'NEXTCARE_RN2_20': { '0-5': {M: 1960, F: 1960}, '6-17': {M: 1312, F: 1312}, '18-30': {M: 1472, F: 2448}, '31-40': {M: 1960, F: 3104}, '41-50': {M: 2616, F: 3552}, '51-60': {M: 3760, F: 4680}, '61-65': {M: 5408, F: 6496} },
    'NEXTCARE_RN_0': { '0-5': {M: 2750, F: 2750}, '6-17': {M: 1840, F: 1840}, '18-30': {M: 2070, F: 3430}, '31-40': {M: 2750, F: 4360}, '41-50': {M: 3670, F: 4980}, '51-60': {M: 5270, F: 6570}, '61-65': {M: 7580, F: 9120} },
    'NEXTCARE_RN_10': { '0-5': {M: 2475, F: 2475}, '6-17': {M: 1656, F: 1656}, '18-30': {M: 1863, F: 3087}, '31-40': {M: 2475, F: 3924}, '41-50': {M: 3303, F: 4482}, '51-60': {M: 4743, F: 5913}, '61-65': {M: 6822, F: 8208} },
    'NEXTCARE_RN_20': { '0-5': {M: 2200, F: 2200}, '6-17': {M: 1472, F: 1472}, '18-30': {M: 1656, F: 2744}, '31-40': {M: 2200, F: 3488}, '41-50': {M: 2936, F: 3984}, '51-60': {M: 4216, F: 5256}, '61-65': {M: 6064, F: 7296} },
    'NEXTCARE_GN_LIMITED_0': { '0-5': {M: 3050, F: 3050}, '6-17': {M: 2040, F: 2040}, '18-30': {M: 2290, F: 3810}, '31-40': {M: 3050, F: 4830}, '41-50': {M: 4070, F: 5520}, '51-60': {M: 5850, F: 7290}, '61-65': {M: 8410, F: 10120} },
    'NEXTCARE_GN_LIMITED_10': { '0-5': {M: 2745, F: 2745}, '6-17': {M: 1836, F: 1836}, '18-30': {M: 2061, F: 3429}, '31-40': {M: 2745, F: 4347}, '41-50': {M: 3663, F: 4968}, '51-60': {M: 5265, F: 6561}, '61-65': {M: 7569, F: 9108} },
    'NEXTCARE_GN_LIMITED_20': { '0-5': {M: 2440, F: 2440}, '6-17': {M: 1632, F: 1632}, '18-30': {M: 1832, F: 3048}, '31-40': {M: 2440, F: 3864}, '41-50': {M: 3256, F: 4416}, '51-60': {M: 4680, F: 5832}, '61-65': {M: 6728, F: 8096} },
    'NEXTCARE_GN_0': { '0-5': {M: 3350, F: 3350}, '6-17': {M: 2240, F: 2240}, '18-30': {M: 2520, F: 4180}, '31-40': {M: 3350, F: 5310}, '41-50': {M: 4470, F: 6070}, '51-60': {M: 6420, F: 8010}, '61-65': {M: 9240, F: 11110} },
    'NEXTCARE_GN_10': { '0-5': {M: 3015, F: 3015}, '6-17': {M: 2016, F: 2016}, '18-30': {M: 2268, F: 3762}, '31-40': {M: 3015, F: 4779}, '41-50': {M: 4023, F: 5463}, '51-60': {M: 5778, F: 7209}, '61-65': {M: 8316, F: 9999} },
    'NEXTCARE_GN_20': { '0-5': {M: 2680, F: 2680}, '6-17': {M: 1792, F: 1792}, '18-30': {M: 2016, F: 3344}, '31-40': {M: 2680, F: 4248}, '41-50': {M: 3576, F: 4856}, '51-60': {M: 5136, F: 6408}, '61-65': {M: 7392, F: 8888} },
    'NEXTCARE_GN_PLUS_0': { '0-5': {M: 3650, F: 3650}, '6-17': {M: 2440, F: 2440}, '18-30': {M: 2740, F: 4550}, '31-40': {M: 3650, F: 5790}, '41-50': {M: 4870, F: 6610}, '51-60': {M: 7000, F: 8720}, '61-65': {M: 10070, F: 12110} },
    'NEXTCARE_GN_PLUS_10': { '0-5': {M: 3285, F: 3285}, '6-17': {M: 2196, F: 2196}, '18-30': {M: 2466, F: 4095}, '31-40': {M: 3285, F: 5211}, '41-50': {M: 4383, F: 5949}, '51-60': {M: 6300, F: 7848}, '61-65': {M: 9063, F: 10899} },
    'NEXTCARE_GN_PLUS_20': { '0-5': {M: 2920, F: 2920}, '6-17': {M: 1952, F: 1952}, '18-30': {M: 2192, F: 3640}, '31-40': {M: 2920, F: 4632}, '41-50': {M: 3896, F: 5288}, '51-60': {M: 5600, F: 6976}, '61-65': {M: 8056, F: 9688} }
  },
  // RAK NEXTCARE Plans
  'RAK_NEXTCARE': {
    'NEXTCARE_PCP_0': { '0-5': {M: 1700, F: 1700}, '6-17': {M: 1140, F: 1140}, '18-30': {M: 1280, F: 2130}, '31-40': {M: 1700, F: 2690}, '41-50': {M: 2270, F: 3080}, '51-60': {M: 3260, F: 4060}, '61-65': {M: 4690, F: 5640} },
    'NEXTCARE_PCP_10': { '0-5': {M: 1530, F: 1530}, '6-17': {M: 1026, F: 1026}, '18-30': {M: 1152, F: 1917}, '31-40': {M: 1530, F: 2421}, '41-50': {M: 2043, F: 2772}, '51-60': {M: 2934, F: 3654}, '61-65': {M: 4221, F: 5076} },
    'NEXTCARE_PCP_20': { '0-5': {M: 1360, F: 1360}, '6-17': {M: 912, F: 912}, '18-30': {M: 1024, F: 1704}, '31-40': {M: 1360, F: 2152}, '41-50': {M: 1816, F: 2464}, '51-60': {M: 2608, F: 3248}, '61-65': {M: 3752, F: 4512} },
    'NEXTCARE_RN3_0': { '0-5': {M: 2000, F: 2000}, '6-17': {M: 1340, F: 1340}, '18-30': {M: 1510, F: 2500}, '31-40': {M: 2000, F: 3170}, '41-50': {M: 2670, F: 3620}, '51-60': {M: 3840, F: 4780}, '61-65': {M: 5520, F: 6630} },
    'NEXTCARE_RN3_10': { '0-5': {M: 1800, F: 1800}, '6-17': {M: 1206, F: 1206}, '18-30': {M: 1359, F: 2250}, '31-40': {M: 1800, F: 2853}, '41-50': {M: 2403, F: 3258}, '51-60': {M: 3456, F: 4302}, '61-65': {M: 4968, F: 5967} },
    'NEXTCARE_RN3_20': { '0-5': {M: 1600, F: 1600}, '6-17': {M: 1072, F: 1072}, '18-30': {M: 1208, F: 2000}, '31-40': {M: 1600, F: 2536}, '41-50': {M: 2136, F: 2896}, '51-60': {M: 3072, F: 3824}, '61-65': {M: 4416, F: 5304} },
    'NEXTCARE_RN2_0': { '0-5': {M: 2300, F: 2300}, '6-17': {M: 1540, F: 1540}, '18-30': {M: 1730, F: 2870}, '31-40': {M: 2300, F: 3640}, '41-50': {M: 3070, F: 4170}, '51-60': {M: 4410, F: 5500}, '61-65': {M: 6350, F: 7630} },
    'NEXTCARE_RN2_10': { '0-5': {M: 2070, F: 2070}, '6-17': {M: 1386, F: 1386}, '18-30': {M: 1557, F: 2583}, '31-40': {M: 2070, F: 3276}, '41-50': {M: 2763, F: 3753}, '51-60': {M: 3969, F: 4950}, '61-65': {M: 5715, F: 6867} },
    'NEXTCARE_RN2_20': { '0-5': {M: 1840, F: 1840}, '6-17': {M: 1232, F: 1232}, '18-30': {M: 1384, F: 2296}, '31-40': {M: 1840, F: 2912}, '41-50': {M: 2456, F: 3336}, '51-60': {M: 3528, F: 4400}, '61-65': {M: 5080, F: 6104} },
    'NEXTCARE_RN_0': { '0-5': {M: 2600, F: 2600}, '6-17': {M: 1740, F: 1740}, '18-30': {M: 1960, F: 3250}, '31-40': {M: 2600, F: 4120}, '41-50': {M: 3470, F: 4710}, '51-60': {M: 4990, F: 6220}, '61-65': {M: 7180, F: 8630} },
    'NEXTCARE_RN_10': { '0-5': {M: 2340, F: 2340}, '6-17': {M: 1566, F: 1566}, '18-30': {M: 1764, F: 2925}, '31-40': {M: 2340, F: 3708}, '41-50': {M: 3123, F: 4239}, '51-60': {M: 4491, F: 5598}, '61-65': {M: 6462, F: 7767} },
    'NEXTCARE_RN_20': { '0-5': {M: 2080, F: 2080}, '6-17': {M: 1392, F: 1392}, '18-30': {M: 1568, F: 2600}, '31-40': {M: 2080, F: 3296}, '41-50': {M: 2776, F: 3768}, '51-60': {M: 3992, F: 4976}, '61-65': {M: 5744, F: 6904} },
    'NEXTCARE_GN_LIMITED_0': { '0-5': {M: 2900, F: 2900}, '6-17': {M: 1940, F: 1940}, '18-30': {M: 2180, F: 3620}, '31-40': {M: 2900, F: 4590}, '41-50': {M: 3870, F: 5250}, '51-60': {M: 5560, F: 6930}, '61-65': {M: 8000, F: 9620} },
    'NEXTCARE_GN_LIMITED_10': { '0-5': {M: 2610, F: 2610}, '6-17': {M: 1746, F: 1746}, '18-30': {M: 1962, F: 3258}, '31-40': {M: 2610, F: 4131}, '41-50': {M: 3483, F: 4725}, '51-60': {M: 5004, F: 6237}, '61-65': {M: 7200, F: 8658} },
    'NEXTCARE_GN_LIMITED_20': { '0-5': {M: 2320, F: 2320}, '6-17': {M: 1552, F: 1552}, '18-30': {M: 1744, F: 2896}, '31-40': {M: 2320, F: 3672}, '41-50': {M: 3096, F: 4200}, '51-60': {M: 4448, F: 5544}, '61-65': {M: 6400, F: 7696} },
    'NEXTCARE_GN_0': { '0-5': {M: 3200, F: 3200}, '6-17': {M: 2140, F: 2140}, '18-30': {M: 2410, F: 4000}, '31-40': {M: 3200, F: 5070}, '41-50': {M: 4270, F: 5800}, '51-60': {M: 6140, F: 7650}, '61-65': {M: 8830, F: 10620} },
    'NEXTCARE_GN_10': { '0-5': {M: 2880, F: 2880}, '6-17': {M: 1926, F: 1926}, '18-30': {M: 2169, F: 3600}, '31-40': {M: 2880, F: 4563}, '41-50': {M: 3843, F: 5220}, '51-60': {M: 5526, F: 6885}, '61-65': {M: 7947, F: 9558} },
    'NEXTCARE_GN_20': { '0-5': {M: 2560, F: 2560}, '6-17': {M: 1712, F: 1712}, '18-30': {M: 1928, F: 3200}, '31-40': {M: 2560, F: 4056}, '41-50': {M: 3416, F: 4640}, '51-60': {M: 4912, F: 6120}, '61-65': {M: 7064, F: 8496} },
    'NEXTCARE_GN_PLUS_0': { '0-5': {M: 3500, F: 3500}, '6-17': {M: 2340, F: 2340}, '18-30': {M: 2630, F: 4370}, '31-40': {M: 3500, F: 5550}, '41-50': {M: 4670, F: 6340}, '51-60': {M: 6710, F: 8370}, '61-65': {M: 9650, F: 11610} },
    'NEXTCARE_GN_PLUS_10': { '0-5': {M: 3150, F: 3150}, '6-17': {M: 2106, F: 2106}, '18-30': {M: 2367, F: 3933}, '31-40': {M: 3150, F: 4995}, '41-50': {M: 4203, F: 5706}, '51-60': {M: 6039, F: 7533}, '61-65': {M: 8685, F: 10449} },
    'NEXTCARE_GN_PLUS_20': { '0-5': {M: 2800, F: 2800}, '6-17': {M: 1872, F: 1872}, '18-30': {M: 2104, F: 3496}, '31-40': {M: 2800, F: 4440}, '41-50': {M: 3736, F: 5072}, '51-60': {M: 5368, F: 6696}, '61-65': {M: 7720, F: 9288} }
  },
  // TAKAFUL EMARAT NAS Plans
  'TAKAFUL_EMARAT_NAS': {
    'NAS_VN_0': { '0-5': {M: 1800, F: 1800}, '6-17': {M: 1200, F: 1200}, '18-30': {M: 1350, F: 2250}, '31-40': {M: 1800, F: 2850}, '41-50': {M: 2400, F: 3250}, '51-60': {M: 3450, F: 4300}, '61-65': {M: 4950, F: 5950} },
    'NAS_VN_10': { '0-5': {M: 1620, F: 1620}, '6-17': {M: 1080, F: 1080}, '18-30': {M: 1215, F: 2025}, '31-40': {M: 1620, F: 2565}, '41-50': {M: 2160, F: 2925}, '51-60': {M: 3105, F: 3870}, '61-65': {M: 4455, F: 5355} },
    'NAS_VN_20': { '0-5': {M: 1440, F: 1440}, '6-17': {M: 960, F: 960}, '18-30': {M: 1080, F: 1800}, '31-40': {M: 1440, F: 2280}, '41-50': {M: 1920, F: 2600}, '51-60': {M: 2760, F: 3440}, '61-65': {M: 3960, F: 4760} },
    'NAS_WN_0': { '0-5': {M: 2100, F: 2100}, '6-17': {M: 1400, F: 1400}, '18-30': {M: 1580, F: 2620}, '31-40': {M: 2100, F: 3330}, '41-50': {M: 2800, F: 3800}, '51-60': {M: 4020, F: 5010}, '61-65': {M: 5780, F: 6950} },
    'NAS_WN_10': { '0-5': {M: 1890, F: 1890}, '6-17': {M: 1260, F: 1260}, '18-30': {M: 1422, F: 2358}, '31-40': {M: 1890, F: 2997}, '41-50': {M: 2520, F: 3420}, '51-60': {M: 3618, F: 4509}, '61-65': {M: 5202, F: 6255} },
    'NAS_WN_20': { '0-5': {M: 1680, F: 1680}, '6-17': {M: 1120, F: 1120}, '18-30': {M: 1264, F: 2096}, '31-40': {M: 1680, F: 2664}, '41-50': {M: 2240, F: 3040}, '51-60': {M: 3216, F: 4008}, '61-65': {M: 4624, F: 5560} },
    'NAS_SRN_0': { '0-5': {M: 2400, F: 2400}, '6-17': {M: 1600, F: 1600}, '18-30': {M: 1800, F: 3000}, '31-40': {M: 2400, F: 3800}, '41-50': {M: 3200, F: 4350}, '51-60': {M: 4600, F: 5730}, '61-65': {M: 6610, F: 7950} },
    'NAS_SRN_10': { '0-5': {M: 2160, F: 2160}, '6-17': {M: 1440, F: 1440}, '18-30': {M: 1620, F: 2700}, '31-40': {M: 2160, F: 3420}, '41-50': {M: 2880, F: 3915}, '51-60': {M: 4140, F: 5157}, '61-65': {M: 5949, F: 7155} },
    'NAS_SRN_20': { '0-5': {M: 1920, F: 1920}, '6-17': {M: 1280, F: 1280}, '18-30': {M: 1440, F: 2400}, '31-40': {M: 1920, F: 3040}, '41-50': {M: 2560, F: 3480}, '51-60': {M: 3680, F: 4584}, '61-65': {M: 5288, F: 6360} },
    'NAS_RN_0': { '0-5': {M: 2700, F: 2700}, '6-17': {M: 1800, F: 1800}, '18-30': {M: 2030, F: 3370}, '31-40': {M: 2700, F: 4280}, '41-50': {M: 3600, F: 4890}, '51-60': {M: 5170, F: 6450}, '61-65': {M: 7440, F: 8950} },
    'NAS_RN_10': { '0-5': {M: 2430, F: 2430}, '6-17': {M: 1620, F: 1620}, '18-30': {M: 1827, F: 3033}, '31-40': {M: 2430, F: 3852}, '41-50': {M: 3240, F: 4401}, '51-60': {M: 4653, F: 5805}, '61-65': {M: 6696, F: 8055} },
    'NAS_RN_20': { '0-5': {M: 2160, F: 2160}, '6-17': {M: 1440, F: 1440}, '18-30': {M: 1624, F: 2696}, '31-40': {M: 2160, F: 3424}, '41-50': {M: 2880, F: 3912}, '51-60': {M: 4136, F: 5160}, '61-65': {M: 5952, F: 7160} },
    'NAS_GN_0': { '0-5': {M: 3000, F: 3000}, '6-17': {M: 2000, F: 2000}, '18-30': {M: 2250, F: 3740}, '31-40': {M: 3000, F: 4750}, '41-50': {M: 4000, F: 5430}, '51-60': {M: 5750, F: 7160}, '61-65': {M: 8270, F: 9940} },
    'NAS_GN_10': { '0-5': {M: 2700, F: 2700}, '6-17': {M: 1800, F: 1800}, '18-30': {M: 2025, F: 3366}, '31-40': {M: 2700, F: 4275}, '41-50': {M: 3600, F: 4887}, '51-60': {M: 5175, F: 6444}, '61-65': {M: 7443, F: 8946} },
    'NAS_GN_20': { '0-5': {M: 2400, F: 2400}, '6-17': {M: 1600, F: 1600}, '18-30': {M: 1800, F: 2992}, '31-40': {M: 2400, F: 3800}, '41-50': {M: 3200, F: 4344}, '51-60': {M: 4600, F: 5728}, '61-65': {M: 6616, F: 7952} },
    'NAS_CN_0': { '0-5': {M: 3300, F: 3300}, '6-17': {M: 2200, F: 2200}, '18-30': {M: 2480, F: 4110}, '31-40': {M: 3300, F: 5230}, '41-50': {M: 4400, F: 5980}, '51-60': {M: 6320, F: 7880}, '61-65': {M: 9090, F: 10940} },
    'NAS_CN_10': { '0-5': {M: 2970, F: 2970}, '6-17': {M: 1980, F: 1980}, '18-30': {M: 2232, F: 3699}, '31-40': {M: 2970, F: 4707}, '41-50': {M: 3960, F: 5382}, '51-60': {M: 5688, F: 7092}, '61-65': {M: 8181, F: 9846} },
    'NAS_CN_20': { '0-5': {M: 2640, F: 2640}, '6-17': {M: 1760, F: 1760}, '18-30': {M: 1984, F: 3288}, '31-40': {M: 2640, F: 4184}, '41-50': {M: 3520, F: 4784}, '51-60': {M: 5056, F: 6304}, '61-65': {M: 7272, F: 8752} }
  },
  // ADAMJEE NAS Plans
  'ADAMJEE_NAS': {
    'NAS_VN_0': { '0-5': {M: 1750, F: 1750}, '6-17': {M: 1170, F: 1170}, '18-30': {M: 1320, F: 2190}, '31-40': {M: 1750, F: 2770}, '41-50': {M: 2340, F: 3170}, '51-60': {M: 3360, F: 4190}, '61-65': {M: 4830, F: 5810} },
    'NAS_VN_10': { '0-5': {M: 1575, F: 1575}, '6-17': {M: 1053, F: 1053}, '18-30': {M: 1188, F: 1971}, '31-40': {M: 1575, F: 2493}, '41-50': {M: 2106, F: 2853}, '51-60': {M: 3024, F: 3771}, '61-65': {M: 4347, F: 5229} },
    'NAS_VN_20': { '0-5': {M: 1400, F: 1400}, '6-17': {M: 936, F: 936}, '18-30': {M: 1056, F: 1752}, '31-40': {M: 1400, F: 2216}, '41-50': {M: 1872, F: 2536}, '51-60': {M: 2688, F: 3352}, '61-65': {M: 3864, F: 4648} },
    'NAS_WN_0': { '0-5': {M: 2050, F: 2050}, '6-17': {M: 1370, F: 1370}, '18-30': {M: 1540, F: 2560}, '31-40': {M: 2050, F: 3250}, '41-50': {M: 2730, F: 3710}, '51-60': {M: 3930, F: 4890}, '61-65': {M: 5650, F: 6790} },
    'NAS_WN_10': { '0-5': {M: 1845, F: 1845}, '6-17': {M: 1233, F: 1233}, '18-30': {M: 1386, F: 2304}, '31-40': {M: 1845, F: 2925}, '41-50': {M: 2457, F: 3339}, '51-60': {M: 3537, F: 4401}, '61-65': {M: 5085, F: 6111} },
    'NAS_WN_20': { '0-5': {M: 1640, F: 1640}, '6-17': {M: 1096, F: 1096}, '18-30': {M: 1232, F: 2048}, '31-40': {M: 1640, F: 2600}, '41-50': {M: 2184, F: 2968}, '51-60': {M: 3144, F: 3912}, '61-65': {M: 4520, F: 5432} },
    'NAS_SRN_0': { '0-5': {M: 2350, F: 2350}, '6-17': {M: 1570, F: 1570}, '18-30': {M: 1770, F: 2940}, '31-40': {M: 2350, F: 3720}, '41-50': {M: 3130, F: 4250}, '51-60': {M: 4500, F: 5610}, '61-65': {M: 6470, F: 7780} },
    'NAS_SRN_10': { '0-5': {M: 2115, F: 2115}, '6-17': {M: 1413, F: 1413}, '18-30': {M: 1593, F: 2646}, '31-40': {M: 2115, F: 3348}, '41-50': {M: 2817, F: 3825}, '51-60': {M: 4050, F: 5049}, '61-65': {M: 5823, F: 7002} },
    'NAS_SRN_20': { '0-5': {M: 1880, F: 1880}, '6-17': {M: 1256, F: 1256}, '18-30': {M: 1416, F: 2352}, '31-40': {M: 1880, F: 2976}, '41-50': {M: 2504, F: 3400}, '51-60': {M: 3600, F: 4488}, '61-65': {M: 5176, F: 6224} },
    'NAS_RN_0': { '0-5': {M: 2650, F: 2650}, '6-17': {M: 1770, F: 1770}, '18-30': {M: 1990, F: 3310}, '31-40': {M: 2650, F: 4200}, '41-50': {M: 3530, F: 4800}, '51-60': {M: 5080, F: 6330}, '61-65': {M: 7300, F: 8780} },
    'NAS_RN_10': { '0-5': {M: 2385, F: 2385}, '6-17': {M: 1593, F: 1593}, '18-30': {M: 1791, F: 2979}, '31-40': {M: 2385, F: 3780}, '41-50': {M: 3177, F: 4320}, '51-60': {M: 4572, F: 5697}, '61-65': {M: 6570, F: 7902} },
    'NAS_RN_20': { '0-5': {M: 2120, F: 2120}, '6-17': {M: 1416, F: 1416}, '18-30': {M: 1592, F: 2648}, '31-40': {M: 2120, F: 3360}, '41-50': {M: 2824, F: 3840}, '51-60': {M: 4064, F: 5064}, '61-65': {M: 5840, F: 7024} },
    'NAS_GN_0': { '0-5': {M: 2950, F: 2950}, '6-17': {M: 1970, F: 1970}, '18-30': {M: 2220, F: 3680}, '31-40': {M: 2950, F: 4670}, '41-50': {M: 3930, F: 5340}, '51-60': {M: 5650, F: 7040}, '61-65': {M: 8130, F: 9770} },
    'NAS_GN_10': { '0-5': {M: 2655, F: 2655}, '6-17': {M: 1773, F: 1773}, '18-30': {M: 1998, F: 3312}, '31-40': {M: 2655, F: 4203}, '41-50': {M: 3537, F: 4806}, '51-60': {M: 5085, F: 6336}, '61-65': {M: 7317, F: 8793} },
    'NAS_GN_20': { '0-5': {M: 2360, F: 2360}, '6-17': {M: 1576, F: 1576}, '18-30': {M: 1776, F: 2944}, '31-40': {M: 2360, F: 3736}, '41-50': {M: 3144, F: 4272}, '51-60': {M: 4520, F: 5632}, '61-65': {M: 6504, F: 7816} },
    'NAS_CN_0': { '0-5': {M: 3250, F: 3250}, '6-17': {M: 2170, F: 2170}, '18-30': {M: 2440, F: 4050}, '31-40': {M: 3250, F: 5150}, '41-50': {M: 4330, F: 5880}, '51-60': {M: 6220, F: 7760}, '61-65': {M: 8950, F: 10760} },
    'NAS_CN_10': { '0-5': {M: 2925, F: 2925}, '6-17': {M: 1953, F: 1953}, '18-30': {M: 2196, F: 3645}, '31-40': {M: 2925, F: 4635}, '41-50': {M: 3897, F: 5292}, '51-60': {M: 5598, F: 6984}, '61-65': {M: 8055, F: 9684} },
    'NAS_CN_20': { '0-5': {M: 2600, F: 2600}, '6-17': {M: 1736, F: 1736}, '18-30': {M: 1952, F: 3240}, '31-40': {M: 2600, F: 4120}, '41-50': {M: 3464, F: 4704}, '51-60': {M: 4976, F: 6208}, '61-65': {M: 7160, F: 8608} }
  },
  // FIDELITY NAS Plans
  'FIDELITY_NAS': {
    'NAS_VN_0': { '0-5': {M: 1850, F: 1850}, '6-17': {M: 1240, F: 1240}, '18-30': {M: 1390, F: 2310}, '31-40': {M: 1850, F: 2930}, '41-50': {M: 2470, F: 3350}, '51-60': {M: 3550, F: 4420}, '61-65': {M: 5100, F: 6140} },
    'NAS_VN_10': { '0-5': {M: 1665, F: 1665}, '6-17': {M: 1116, F: 1116}, '18-30': {M: 1251, F: 2079}, '31-40': {M: 1665, F: 2637}, '41-50': {M: 2223, F: 3015}, '51-60': {M: 3195, F: 3978}, '61-65': {M: 4590, F: 5526} },
    'NAS_VN_20': { '0-5': {M: 1480, F: 1480}, '6-17': {M: 992, F: 992}, '18-30': {M: 1112, F: 1848}, '31-40': {M: 1480, F: 2344}, '41-50': {M: 1976, F: 2680}, '51-60': {M: 2840, F: 3536}, '61-65': {M: 4080, F: 4912} },
    'NAS_WN_0': { '0-5': {M: 2150, F: 2150}, '6-17': {M: 1440, F: 1440}, '18-30': {M: 1620, F: 2690}, '31-40': {M: 2150, F: 3410}, '41-50': {M: 2870, F: 3900}, '51-60': {M: 4120, F: 5140}, '61-65': {M: 5930, F: 7130} },
    'NAS_WN_10': { '0-5': {M: 1935, F: 1935}, '6-17': {M: 1296, F: 1296}, '18-30': {M: 1458, F: 2421}, '31-40': {M: 1935, F: 3069}, '41-50': {M: 2583, F: 3510}, '51-60': {M: 3708, F: 4626}, '61-65': {M: 5337, F: 6417} },
    'NAS_WN_20': { '0-5': {M: 1720, F: 1720}, '6-17': {M: 1152, F: 1152}, '18-30': {M: 1296, F: 2152}, '31-40': {M: 1720, F: 2728}, '41-50': {M: 2296, F: 3120}, '51-60': {M: 3296, F: 4112}, '61-65': {M: 4744, F: 5704} },
    'NAS_SRN_0': { '0-5': {M: 2450, F: 2450}, '6-17': {M: 1640, F: 1640}, '18-30': {M: 1840, F: 3060}, '31-40': {M: 2450, F: 3880}, '41-50': {M: 3270, F: 4440}, '51-60': {M: 4700, F: 5850}, '61-65': {M: 6760, F: 8120} },
    'NAS_SRN_10': { '0-5': {M: 2205, F: 2205}, '6-17': {M: 1476, F: 1476}, '18-30': {M: 1656, F: 2754}, '31-40': {M: 2205, F: 3492}, '41-50': {M: 2943, F: 3996}, '51-60': {M: 4230, F: 5265}, '61-65': {M: 6084, F: 7308} },
    'NAS_SRN_20': { '0-5': {M: 1960, F: 1960}, '6-17': {M: 1312, F: 1312}, '18-30': {M: 1472, F: 2448}, '31-40': {M: 1960, F: 3104}, '41-50': {M: 2616, F: 3552}, '51-60': {M: 3760, F: 4680}, '61-65': {M: 5408, F: 6496} },
    'NAS_RN_0': { '0-5': {M: 2750, F: 2750}, '6-17': {M: 1840, F: 1840}, '18-30': {M: 2070, F: 3430}, '31-40': {M: 2750, F: 4360}, '41-50': {M: 3670, F: 4980}, '51-60': {M: 5270, F: 6570}, '61-65': {M: 7580, F: 9120} },
    'NAS_RN_10': { '0-5': {M: 2475, F: 2475}, '6-17': {M: 1656, F: 1656}, '18-30': {M: 1863, F: 3087}, '31-40': {M: 2475, F: 3924}, '41-50': {M: 3303, F: 4482}, '51-60': {M: 4743, F: 5913}, '61-65': {M: 6822, F: 8208} },
    'NAS_RN_20': { '0-5': {M: 2200, F: 2200}, '6-17': {M: 1472, F: 1472}, '18-30': {M: 1656, F: 2744}, '31-40': {M: 2200, F: 3488}, '41-50': {M: 2936, F: 3984}, '51-60': {M: 4216, F: 5256}, '61-65': {M: 6064, F: 7296} },
    'NAS_GN_0': { '0-5': {M: 3050, F: 3050}, '6-17': {M: 2040, F: 2040}, '18-30': {M: 2290, F: 3810}, '31-40': {M: 3050, F: 4830}, '41-50': {M: 4070, F: 5520}, '51-60': {M: 5850, F: 7290}, '61-65': {M: 8410, F: 10120} },
    'NAS_GN_10': { '0-5': {M: 2745, F: 2745}, '6-17': {M: 1836, F: 1836}, '18-30': {M: 2061, F: 3429}, '31-40': {M: 2745, F: 4347}, '41-50': {M: 3663, F: 4968}, '51-60': {M: 5265, F: 6561}, '61-65': {M: 7569, F: 9108} },
    'NAS_GN_20': { '0-5': {M: 2440, F: 2440}, '6-17': {M: 1632, F: 1632}, '18-30': {M: 1832, F: 3048}, '31-40': {M: 2440, F: 3864}, '41-50': {M: 3256, F: 4416}, '51-60': {M: 4680, F: 5832}, '61-65': {M: 6728, F: 8096} },
    'NAS_CN_0': { '0-5': {M: 3350, F: 3350}, '6-17': {M: 2240, F: 2240}, '18-30': {M: 2520, F: 4180}, '31-40': {M: 3350, F: 5310}, '41-50': {M: 4470, F: 6070}, '51-60': {M: 6420, F: 8010}, '61-65': {M: 9240, F: 11110} },
    'NAS_CN_10': { '0-5': {M: 3015, F: 3015}, '6-17': {M: 2016, F: 2016}, '18-30': {M: 2268, F: 3762}, '31-40': {M: 3015, F: 4779}, '41-50': {M: 4023, F: 5463}, '51-60': {M: 5778, F: 7209}, '61-65': {M: 8316, F: 9999} },
    'NAS_CN_20': { '0-5': {M: 2680, F: 2680}, '6-17': {M: 1792, F: 1792}, '18-30': {M: 2016, F: 3344}, '31-40': {M: 2680, F: 4248}, '41-50': {M: 3576, F: 4856}, '51-60': {M: 5136, F: 6408}, '61-65': {M: 7392, F: 8888} }
  },
  // LIVA NAS Plans
  'LIVA_NAS': {
    'NAS_VN_0': { '0-5': {M: 1700, F: 1700}, '6-17': {M: 1140, F: 1140}, '18-30': {M: 1280, F: 2130}, '31-40': {M: 1700, F: 2690}, '41-50': {M: 2270, F: 3080}, '51-60': {M: 3260, F: 4060}, '61-65': {M: 4690, F: 5640} },
    'NAS_VN_10': { '0-5': {M: 1530, F: 1530}, '6-17': {M: 1026, F: 1026}, '18-30': {M: 1152, F: 1917}, '31-40': {M: 1530, F: 2421}, '41-50': {M: 2043, F: 2772}, '51-60': {M: 2934, F: 3654}, '61-65': {M: 4221, F: 5076} },
    'NAS_VN_20': { '0-5': {M: 1360, F: 1360}, '6-17': {M: 912, F: 912}, '18-30': {M: 1024, F: 1704}, '31-40': {M: 1360, F: 2152}, '41-50': {M: 1816, F: 2464}, '51-60': {M: 2608, F: 3248}, '61-65': {M: 3752, F: 4512} },
    'NAS_WN_0': { '0-5': {M: 2000, F: 2000}, '6-17': {M: 1340, F: 1340}, '18-30': {M: 1510, F: 2500}, '31-40': {M: 2000, F: 3170}, '41-50': {M: 2670, F: 3620}, '51-60': {M: 3840, F: 4780}, '61-65': {M: 5520, F: 6630} },
    'NAS_WN_10': { '0-5': {M: 1800, F: 1800}, '6-17': {M: 1206, F: 1206}, '18-30': {M: 1359, F: 2250}, '31-40': {M: 1800, F: 2853}, '41-50': {M: 2403, F: 3258}, '51-60': {M: 3456, F: 4302}, '61-65': {M: 4968, F: 5967} },
    'NAS_WN_20': { '0-5': {M: 1600, F: 1600}, '6-17': {M: 1072, F: 1072}, '18-30': {M: 1208, F: 2000}, '31-40': {M: 1600, F: 2536}, '41-50': {M: 2136, F: 2896}, '51-60': {M: 3072, F: 3824}, '61-65': {M: 4416, F: 5304} },
    'NAS_SRN_0': { '0-5': {M: 2300, F: 2300}, '6-17': {M: 1540, F: 1540}, '18-30': {M: 1730, F: 2870}, '31-40': {M: 2300, F: 3640}, '41-50': {M: 3070, F: 4170}, '51-60': {M: 4410, F: 5500}, '61-65': {M: 6350, F: 7630} },
    'NAS_SRN_10': { '0-5': {M: 2070, F: 2070}, '6-17': {M: 1386, F: 1386}, '18-30': {M: 1557, F: 2583}, '31-40': {M: 2070, F: 3276}, '41-50': {M: 2763, F: 3753}, '51-60': {M: 3969, F: 4950}, '61-65': {M: 5715, F: 6867} },
    'NAS_SRN_20': { '0-5': {M: 1840, F: 1840}, '6-17': {M: 1232, F: 1232}, '18-30': {M: 1384, F: 2296}, '31-40': {M: 1840, F: 2912}, '41-50': {M: 2456, F: 3336}, '51-60': {M: 3528, F: 4400}, '61-65': {M: 5080, F: 6104} },
    'NAS_RN_0': { '0-5': {M: 2600, F: 2600}, '6-17': {M: 1740, F: 1740}, '18-30': {M: 1960, F: 3250}, '31-40': {M: 2600, F: 4120}, '41-50': {M: 3470, F: 4710}, '51-60': {M: 4990, F: 6220}, '61-65': {M: 7180, F: 8630} },
    'NAS_RN_10': { '0-5': {M: 2340, F: 2340}, '6-17': {M: 1566, F: 1566}, '18-30': {M: 1764, F: 2925}, '31-40': {M: 2340, F: 3708}, '41-50': {M: 3123, F: 4239}, '51-60': {M: 4491, F: 5598}, '61-65': {M: 6462, F: 7767} },
    'NAS_RN_20': { '0-5': {M: 2080, F: 2080}, '6-17': {M: 1392, F: 1392}, '18-30': {M: 1568, F: 2600}, '31-40': {M: 2080, F: 3296}, '41-50': {M: 2776, F: 3768}, '51-60': {M: 3992, F: 4976}, '61-65': {M: 5744, F: 6904} },
    'NAS_GN_0': { '0-5': {M: 2900, F: 2900}, '6-17': {M: 1940, F: 1940}, '18-30': {M: 2180, F: 3620}, '31-40': {M: 2900, F: 4590}, '41-50': {M: 3870, F: 5250}, '51-60': {M: 5560, F: 6930}, '61-65': {M: 8000, F: 9620} },
    'NAS_GN_10': { '0-5': {M: 2610, F: 2610}, '6-17': {M: 1746, F: 1746}, '18-30': {M: 1962, F: 3258}, '31-40': {M: 2610, F: 4131}, '41-50': {M: 3483, F: 4725}, '51-60': {M: 5004, F: 6237}, '61-65': {M: 7200, F: 8658} },
    'NAS_GN_20': { '0-5': {M: 2320, F: 2320}, '6-17': {M: 1552, F: 1552}, '18-30': {M: 1744, F: 2896}, '31-40': {M: 2320, F: 3672}, '41-50': {M: 3096, F: 4200}, '51-60': {M: 4448, F: 5544}, '61-65': {M: 6400, F: 7696} },
    'NAS_CN_0': { '0-5': {M: 3200, F: 3200}, '6-17': {M: 2140, F: 2140}, '18-30': {M: 2410, F: 4000}, '31-40': {M: 3200, F: 5070}, '41-50': {M: 4270, F: 5800}, '51-60': {M: 6140, F: 7650}, '61-65': {M: 8830, F: 10620} },
    'NAS_CN_10': { '0-5': {M: 2880, F: 2880}, '6-17': {M: 1926, F: 1926}, '18-30': {M: 2169, F: 3600}, '31-40': {M: 2880, F: 4563}, '41-50': {M: 3843, F: 5220}, '51-60': {M: 5526, F: 6885}, '61-65': {M: 7947, F: 9558} },
    'NAS_CN_20': { '0-5': {M: 2560, F: 2560}, '6-17': {M: 1712, F: 1712}, '18-30': {M: 1928, F: 3200}, '31-40': {M: 2560, F: 4056}, '41-50': {M: 3416, F: 4640}, '51-60': {M: 4912, F: 6120}, '61-65': {M: 7064, F: 8496} }
  },
  // RAK NAS Plans
  'RAK_NAS': {
    'NAS_VN_0': { '0-5': {M: 1650, F: 1650}, '6-17': {M: 1110, F: 1110}, '18-30': {M: 1250, F: 2070}, '31-40': {M: 1650, F: 2610}, '41-50': {M: 2200, F: 2990}, '51-60': {M: 3160, F: 3940}, '61-65': {M: 4550, F: 5470} },
    'NAS_VN_10': { '0-5': {M: 1485, F: 1485}, '6-17': {M: 999, F: 999}, '18-30': {M: 1125, F: 1863}, '31-40': {M: 1485, F: 2349}, '41-50': {M: 1980, F: 2691}, '51-60': {M: 2844, F: 3546}, '61-65': {M: 4095, F: 4923} },
    'NAS_VN_20': { '0-5': {M: 1320, F: 1320}, '6-17': {M: 888, F: 888}, '18-30': {M: 1000, F: 1656}, '31-40': {M: 1320, F: 2088}, '41-50': {M: 1760, F: 2392}, '51-60': {M: 2528, F: 3152}, '61-65': {M: 3640, F: 4376} },
    'NAS_WN_0': { '0-5': {M: 1950, F: 1950}, '6-17': {M: 1310, F: 1310}, '18-30': {M: 1470, F: 2440}, '31-40': {M: 1950, F: 3090}, '41-50': {M: 2600, F: 3530}, '51-60': {M: 3740, F: 4660}, '61-65': {M: 5380, F: 6460} },
    'NAS_WN_10': { '0-5': {M: 1755, F: 1755}, '6-17': {M: 1179, F: 1179}, '18-30': {M: 1323, F: 2196}, '31-40': {M: 1755, F: 2781}, '41-50': {M: 2340, F: 3177}, '51-60': {M: 3366, F: 4194}, '61-65': {M: 4842, F: 5814} },
    'NAS_WN_20': { '0-5': {M: 1560, F: 1560}, '6-17': {M: 1048, F: 1048}, '18-30': {M: 1176, F: 1952}, '31-40': {M: 1560, F: 2472}, '41-50': {M: 2080, F: 2824}, '51-60': {M: 2992, F: 3728}, '61-65': {M: 4304, F: 5168} },
    'NAS_SRN_0': { '0-5': {M: 2250, F: 2250}, '6-17': {M: 1510, F: 1510}, '18-30': {M: 1700, F: 2820}, '31-40': {M: 2250, F: 3560}, '41-50': {M: 3000, F: 4080}, '51-60': {M: 4310, F: 5380}, '61-65': {M: 6200, F: 7460} },
    'NAS_SRN_10': { '0-5': {M: 2025, F: 2025}, '6-17': {M: 1359, F: 1359}, '18-30': {M: 1530, F: 2538}, '31-40': {M: 2025, F: 3204}, '41-50': {M: 2700, F: 3672}, '51-60': {M: 3879, F: 4842}, '61-65': {M: 5580, F: 6714} },
    'NAS_SRN_20': { '0-5': {M: 1800, F: 1800}, '6-17': {M: 1208, F: 1208}, '18-30': {M: 1360, F: 2256}, '31-40': {M: 1800, F: 2848}, '41-50': {M: 2400, F: 3264}, '51-60': {M: 3448, F: 4304}, '61-65': {M: 4960, F: 5968} },
    'NAS_RN_0': { '0-5': {M: 2550, F: 2550}, '6-17': {M: 1710, F: 1710}, '18-30': {M: 1920, F: 3190}, '31-40': {M: 2550, F: 4040}, '41-50': {M: 3400, F: 4620}, '51-60': {M: 4890, F: 6090}, '61-65': {M: 7030, F: 8450} },
    'NAS_RN_10': { '0-5': {M: 2295, F: 2295}, '6-17': {M: 1539, F: 1539}, '18-30': {M: 1728, F: 2871}, '31-40': {M: 2295, F: 3636}, '41-50': {M: 3060, F: 4158}, '51-60': {M: 4401, F: 5481}, '61-65': {M: 6327, F: 7605} },
    'NAS_RN_20': { '0-5': {M: 2040, F: 2040}, '6-17': {M: 1368, F: 1368}, '18-30': {M: 1536, F: 2552}, '31-40': {M: 2040, F: 3232}, '41-50': {M: 2720, F: 3696}, '51-60': {M: 3912, F: 4872}, '61-65': {M: 5624, F: 6760} },
    'NAS_GN_0': { '0-5': {M: 2850, F: 2850}, '6-17': {M: 1910, F: 1910}, '18-30': {M: 2150, F: 3560}, '31-40': {M: 2850, F: 4510}, '41-50': {M: 3800, F: 5160}, '51-60': {M: 5460, F: 6810}, '61-65': {M: 7860, F: 9450} },
    'NAS_GN_10': { '0-5': {M: 2565, F: 2565}, '6-17': {M: 1719, F: 1719}, '18-30': {M: 1935, F: 3204}, '31-40': {M: 2565, F: 4059}, '41-50': {M: 3420, F: 4644}, '51-60': {M: 4914, F: 6129}, '61-65': {M: 7074, F: 8505} },
    'NAS_GN_20': { '0-5': {M: 2280, F: 2280}, '6-17': {M: 1528, F: 1528}, '18-30': {M: 1720, F: 2848}, '31-40': {M: 2280, F: 3608}, '41-50': {M: 3040, F: 4128}, '51-60': {M: 4368, F: 5448}, '61-65': {M: 6288, F: 7560} },
    'NAS_CN_0': { '0-5': {M: 3150, F: 3150}, '6-17': {M: 2110, F: 2110}, '18-30': {M: 2370, F: 3930}, '31-40': {M: 3150, F: 4990}, '41-50': {M: 4200, F: 5700}, '51-60': {M: 6030, F: 7520}, '61-65': {M: 8680, F: 10430} },
    'NAS_CN_10': { '0-5': {M: 2835, F: 2835}, '6-17': {M: 1899, F: 1899}, '18-30': {M: 2133, F: 3537}, '31-40': {M: 2835, F: 4491}, '41-50': {M: 3780, F: 5130}, '51-60': {M: 5427, F: 6768}, '61-65': {M: 7812, F: 9387} },
    'NAS_CN_20': { '0-5': {M: 2520, F: 2520}, '6-17': {M: 1688, F: 1688}, '18-30': {M: 1896, F: 3144}, '31-40': {M: 2520, F: 3992}, '41-50': {M: 3360, F: 4560}, '51-60': {M: 4824, F: 6016}, '61-65': {M: 6944, F: 8344} }
  },
  // WATANIA TAKAFUL NAS Plans
  'WATANIA_NAS': {
    'NAS_VN_0': { '0-5': {M: 1600, F: 1600}, '6-17': {M: 1080, F: 1080}, '18-30': {M: 1210, F: 2010}, '31-40': {M: 1600, F: 2530}, '41-50': {M: 2140, F: 2900}, '51-60': {M: 3070, F: 3830}, '61-65': {M: 4420, F: 5310} },
    'NAS_VN_10': { '0-5': {M: 1440, F: 1440}, '6-17': {M: 972, F: 972}, '18-30': {M: 1089, F: 1809}, '31-40': {M: 1440, F: 2277}, '41-50': {M: 1926, F: 2610}, '51-60': {M: 2763, F: 3447}, '61-65': {M: 3978, F: 4779} },
    'NAS_VN_20': { '0-5': {M: 1280, F: 1280}, '6-17': {M: 864, F: 864}, '18-30': {M: 968, F: 1608}, '31-40': {M: 1280, F: 2024}, '41-50': {M: 1712, F: 2320}, '51-60': {M: 2456, F: 3064}, '61-65': {M: 3536, F: 4248} },
    'NAS_WN_0': { '0-5': {M: 1900, F: 1900}, '6-17': {M: 1280, F: 1280}, '18-30': {M: 1440, F: 2390}, '31-40': {M: 1900, F: 3010}, '41-50': {M: 2540, F: 3440}, '51-60': {M: 3650, F: 4550}, '61-65': {M: 5250, F: 6310} },
    'NAS_WN_10': { '0-5': {M: 1710, F: 1710}, '6-17': {M: 1152, F: 1152}, '18-30': {M: 1296, F: 2151}, '31-40': {M: 1710, F: 2709}, '41-50': {M: 2286, F: 3096}, '51-60': {M: 3285, F: 4095}, '61-65': {M: 4725, F: 5679} },
    'NAS_WN_20': { '0-5': {M: 1520, F: 1520}, '6-17': {M: 1024, F: 1024}, '18-30': {M: 1152, F: 1912}, '31-40': {M: 1520, F: 2408}, '41-50': {M: 2032, F: 2752}, '51-60': {M: 2920, F: 3640}, '61-65': {M: 4200, F: 5048} },
    'NAS_SRN_0': { '0-5': {M: 2200, F: 2200}, '6-17': {M: 1480, F: 1480}, '18-30': {M: 1660, F: 2760}, '31-40': {M: 2200, F: 3480}, '41-50': {M: 2940, F: 3990}, '51-60': {M: 4220, F: 5260}, '61-65': {M: 6070, F: 7300} },
    'NAS_SRN_10': { '0-5': {M: 1980, F: 1980}, '6-17': {M: 1332, F: 1332}, '18-30': {M: 1494, F: 2484}, '31-40': {M: 1980, F: 3132}, '41-50': {M: 2646, F: 3591}, '51-60': {M: 3798, F: 4734}, '61-65': {M: 5463, F: 6570} },
    'NAS_SRN_20': { '0-5': {M: 1760, F: 1760}, '6-17': {M: 1184, F: 1184}, '18-30': {M: 1328, F: 2208}, '31-40': {M: 1760, F: 2784}, '41-50': {M: 2352, F: 3192}, '51-60': {M: 3376, F: 4208}, '61-65': {M: 4856, F: 5840} },
    'NAS_RN_0': { '0-5': {M: 2500, F: 2500}, '6-17': {M: 1680, F: 1680}, '18-30': {M: 1890, F: 3130}, '31-40': {M: 2500, F: 3960}, '41-50': {M: 3340, F: 4530}, '51-60': {M: 4800, F: 5980}, '61-65': {M: 6900, F: 8300} },
    'NAS_RN_10': { '0-5': {M: 2250, F: 2250}, '6-17': {M: 1512, F: 1512}, '18-30': {M: 1701, F: 2817}, '31-40': {M: 2250, F: 3564}, '41-50': {M: 3006, F: 4077}, '51-60': {M: 4320, F: 5382}, '61-65': {M: 6210, F: 7470} },
    'NAS_RN_20': { '0-5': {M: 2000, F: 2000}, '6-17': {M: 1344, F: 1344}, '18-30': {M: 1512, F: 2504}, '31-40': {M: 2000, F: 3168}, '41-50': {M: 2672, F: 3624}, '51-60': {M: 3840, F: 4784}, '61-65': {M: 5520, F: 6640} },
    'NAS_GN_0': { '0-5': {M: 2800, F: 2800}, '6-17': {M: 1880, F: 1880}, '18-30': {M: 2110, F: 3500}, '31-40': {M: 2800, F: 4430}, '41-50': {M: 3740, F: 5070}, '51-60': {M: 5370, F: 6700}, '61-65': {M: 7730, F: 9290} },
    'NAS_GN_10': { '0-5': {M: 2520, F: 2520}, '6-17': {M: 1692, F: 1692}, '18-30': {M: 1899, F: 3150}, '31-40': {M: 2520, F: 3987}, '41-50': {M: 3366, F: 4563}, '51-60': {M: 4833, F: 6030}, '61-65': {M: 6957, F: 8361} },
    'NAS_GN_20': { '0-5': {M: 2240, F: 2240}, '6-17': {M: 1504, F: 1504}, '18-30': {M: 1688, F: 2800}, '31-40': {M: 2240, F: 3544}, '41-50': {M: 2992, F: 4056}, '51-60': {M: 4296, F: 5360}, '61-65': {M: 6184, F: 7432} },
    'NAS_CN_0': { '0-5': {M: 3100, F: 3100}, '6-17': {M: 2080, F: 2080}, '18-30': {M: 2340, F: 3880}, '31-40': {M: 3100, F: 4910}, '41-50': {M: 4140, F: 5620}, '51-60': {M: 5940, F: 7410}, '61-65': {M: 8550, F: 10280} },
    'NAS_CN_10': { '0-5': {M: 2790, F: 2790}, '6-17': {M: 1872, F: 1872}, '18-30': {M: 2106, F: 3492}, '31-40': {M: 2790, F: 4419}, '41-50': {M: 3726, F: 5058}, '51-60': {M: 5346, F: 6669}, '61-65': {M: 7695, F: 9252} },
    'NAS_CN_20': { '0-5': {M: 2480, F: 2480}, '6-17': {M: 1664, F: 1664}, '18-30': {M: 1872, F: 3104}, '31-40': {M: 2480, F: 3928}, '41-50': {M: 3312, F: 4496}, '51-60': {M: 4752, F: 5928}, '61-65': {M: 6840, F: 8224} }
  },
  // QATAR INSURANCE NAS Plans
  'QATAR_INSURANCE_NAS': {
    'NAS_VN_0': { '0-5': {M: 1750, F: 1750}, '6-17': {M: 1180, F: 1180}, '18-30': {M: 1320, F: 2200}, '31-40': {M: 1750, F: 2770}, '41-50': {M: 2340, F: 3170}, '51-60': {M: 3360, F: 4190}, '61-65': {M: 4830, F: 5810} },
    'NAS_VN_10': { '0-5': {M: 1575, F: 1575}, '6-17': {M: 1062, F: 1062}, '18-30': {M: 1188, F: 1980}, '31-40': {M: 1575, F: 2493}, '41-50': {M: 2106, F: 2853}, '51-60': {M: 3024, F: 3771}, '61-65': {M: 4347, F: 5229} },
    'NAS_VN_20': { '0-5': {M: 1400, F: 1400}, '6-17': {M: 944, F: 944}, '18-30': {M: 1056, F: 1760}, '31-40': {M: 1400, F: 2216}, '41-50': {M: 1872, F: 2536}, '51-60': {M: 2688, F: 3352}, '61-65': {M: 3864, F: 4648} },
    'NAS_WN_0': { '0-5': {M: 2050, F: 2050}, '6-17': {M: 1380, F: 1380}, '18-30': {M: 1550, F: 2570}, '31-40': {M: 2050, F: 3250}, '41-50': {M: 2740, F: 3720}, '51-60': {M: 3940, F: 4900}, '61-65': {M: 5660, F: 6810} },
    'NAS_WN_10': { '0-5': {M: 1845, F: 1845}, '6-17': {M: 1242, F: 1242}, '18-30': {M: 1395, F: 2313}, '31-40': {M: 1845, F: 2925}, '41-50': {M: 2466, F: 3348}, '51-60': {M: 3546, F: 4410}, '61-65': {M: 5094, F: 6129} },
    'NAS_WN_20': { '0-5': {M: 1640, F: 1640}, '6-17': {M: 1104, F: 1104}, '18-30': {M: 1240, F: 2056}, '31-40': {M: 1640, F: 2600}, '41-50': {M: 2192, F: 2976}, '51-60': {M: 3152, F: 3920}, '61-65': {M: 4528, F: 5448} },
    'NAS_SRN_0': { '0-5': {M: 2350, F: 2350}, '6-17': {M: 1580, F: 1580}, '18-30': {M: 1780, F: 2950}, '31-40': {M: 2350, F: 3720}, '41-50': {M: 3140, F: 4260}, '51-60': {M: 4510, F: 5620}, '61-65': {M: 6490, F: 7800} },
    'NAS_SRN_10': { '0-5': {M: 2115, F: 2115}, '6-17': {M: 1422, F: 1422}, '18-30': {M: 1602, F: 2655}, '31-40': {M: 2115, F: 3348}, '41-50': {M: 2826, F: 3834}, '51-60': {M: 4059, F: 5058}, '61-65': {M: 5841, F: 7020} },
    'NAS_SRN_20': { '0-5': {M: 1880, F: 1880}, '6-17': {M: 1264, F: 1264}, '18-30': {M: 1424, F: 2360}, '31-40': {M: 1880, F: 2976}, '41-50': {M: 2512, F: 3408}, '51-60': {M: 3608, F: 4496}, '61-65': {M: 5192, F: 6240} },
    'NAS_RN_0': { '0-5': {M: 2650, F: 2650}, '6-17': {M: 1780, F: 1780}, '18-30': {M: 2000, F: 3320}, '31-40': {M: 2650, F: 4200}, '41-50': {M: 3540, F: 4800}, '51-60': {M: 5090, F: 6340}, '61-65': {M: 7320, F: 8800} },
    'NAS_RN_10': { '0-5': {M: 2385, F: 2385}, '6-17': {M: 1602, F: 1602}, '18-30': {M: 1800, F: 2988}, '31-40': {M: 2385, F: 3780}, '41-50': {M: 3186, F: 4320}, '51-60': {M: 4581, F: 5706}, '61-65': {M: 6588, F: 7920} },
    'NAS_RN_20': { '0-5': {M: 2120, F: 2120}, '6-17': {M: 1424, F: 1424}, '18-30': {M: 1600, F: 2656}, '31-40': {M: 2120, F: 3360}, '41-50': {M: 2832, F: 3840}, '51-60': {M: 4072, F: 5072}, '61-65': {M: 5856, F: 7040} },
    'NAS_GN_0': { '0-5': {M: 2950, F: 2950}, '6-17': {M: 1980, F: 1980}, '18-30': {M: 2230, F: 3700}, '31-40': {M: 2950, F: 4670}, '41-50': {M: 3940, F: 5350}, '51-60': {M: 5660, F: 7060}, '61-65': {M: 8140, F: 9790} },
    'NAS_GN_10': { '0-5': {M: 2655, F: 2655}, '6-17': {M: 1782, F: 1782}, '18-30': {M: 2007, F: 3330}, '31-40': {M: 2655, F: 4203}, '41-50': {M: 3546, F: 4815}, '51-60': {M: 5094, F: 6354}, '61-65': {M: 7326, F: 8811} },
    'NAS_GN_20': { '0-5': {M: 2360, F: 2360}, '6-17': {M: 1584, F: 1584}, '18-30': {M: 1784, F: 2960}, '31-40': {M: 2360, F: 3736}, '41-50': {M: 3152, F: 4280}, '51-60': {M: 4528, F: 5648}, '61-65': {M: 6512, F: 7832} },
    'NAS_CN_0': { '0-5': {M: 3250, F: 3250}, '6-17': {M: 2180, F: 2180}, '18-30': {M: 2450, F: 4070}, '31-40': {M: 3250, F: 5150}, '41-50': {M: 4340, F: 5890}, '51-60': {M: 6240, F: 7780}, '61-65': {M: 8970, F: 10790} },
    'NAS_CN_10': { '0-5': {M: 2925, F: 2925}, '6-17': {M: 1962, F: 1962}, '18-30': {M: 2205, F: 3663}, '31-40': {M: 2925, F: 4635}, '41-50': {M: 3906, F: 5301}, '51-60': {M: 5616, F: 7002}, '61-65': {M: 8073, F: 9711} },
    'NAS_CN_20': { '0-5': {M: 2600, F: 2600}, '6-17': {M: 1744, F: 1744}, '18-30': {M: 1960, F: 3256}, '31-40': {M: 2600, F: 4120}, '41-50': {M: 3472, F: 4712}, '51-60': {M: 4992, F: 6224}, '61-65': {M: 7176, F: 8632} }
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
  { id: 'AL_SAGR', name: 'AL SAGR NATIONAL', networks: ['NEXTCARE', 'MEDNET', 'NAS'] },
  { id: 'CIGNA', name: 'CIGNA', networks: ['Regional', 'International', 'International Plus'] },
  { id: 'BUPA', name: 'BUPA', networks: ['BUPA Network'] },
  { id: 'HENSMERKUR', name: 'HENSMERKUR', networks: ['HENSMERKUR Network'] },
  { id: 'TAKAFUL_EMARAT_MANUAL', name: 'TAKAFUL EMARAT', networks: ['NEXTCARE RN3', 'NEXTCARE RN2', 'NEXTCARE RN', 'NEXTCARE GN', 'NEXTCARE GN PLUS', 'MEDNET SilkRoad', 'MEDNET Pearl', 'MEDNET Emerald', 'MEDNET Green', 'MEDNET Silver Classic', 'MEDNET Silver Premium', 'MEDNET Gold', 'NAS VN', 'NAS WN', 'NAS SRN', 'NAS RN', 'NAS GN', 'NAS CN', 'AAFIYA APN', 'AAFIYA APN PLUS', 'AAFIYA ESSENTIAL', 'NE BASIC IP ONLY', 'NE BASIC PLAN', 'NE BASIC ENHANCED', 'NE BASIC ENHANCED PLUS', 'ECARE BLUE 1', 'ECARE BLUE 2', 'ECARE BLUE 3', 'ECARE BLUE 4'] },
  { id: 'MEDGULF', name: 'MEDGULF', networks: ['MEDNET', 'NEXTCARE', 'NAS'] },
  { id: 'LIVA', name: 'LIVA', networks: ['NAS WN', 'NAS SRN', 'NAS RN', 'NAS GN', 'NAS CN', 'MEDNET SilkRoad', 'MEDNET Pearl', 'MEDNET Emerald', 'MEDNET Green', 'MEDNET Silver Classic', 'MEDNET Silver Premium', 'MEDNET Gold', 'INAYAH'] },
  { id: 'SUKOON', name: 'SUKOON', networks: ['SAFE', 'HOME', 'HOMELITE', 'PRO', 'PRIME', 'MAX'] },
  { id: 'DIC', name: 'DIC', networks: ['ISON', 'MEDNET', 'DUBAICARE'] },
  { id: 'ORIENT_MANUAL', name: 'ORIENT', networks: ['NEXTCARE RN3', 'NEXTCARE RN2', 'NEXTCARE RN', 'NEXTCARE GN', 'NEXTCARE GN PLUS', 'MEDNET SilkRoad', 'MEDNET Pearl', 'MEDNET Emerald', 'MEDNET Green', 'MEDNET Silver Classic', 'MEDNET Silver Premium', 'MEDNET Gold'] },
  { id: 'ADAMJEE', name: 'ADAMJEE', networks: ['MEDNET SilkRoad', 'MEDNET Pearl', 'MEDNET Emerald', 'MEDNET Green', 'MEDNET Silver Classic', 'MEDNET Silver Premium', 'MEDNET Gold', 'NAS WN', 'NAS SRN', 'NAS RN', 'NAS GN', 'NAS CN'] },
  { id: 'FIDELITY_MANUAL', name: 'FIDELITY', networks: ['NEXTCARE PCP RN3', 'NEXTCARE RN3', 'NEXTCARE RN2', 'NEXTCARE RN', 'NEXTCARE GN', 'NEXTCARE GN PLUS', 'NAS VN', 'NAS WN', 'NAS SRN', 'NAS RN', 'NAS GN', 'NAS CN'] },
  { id: 'DUBAI_INSURANCE', name: 'DUBAI INSURANCE', networks: ['DUBAICARE N5', 'DUBAICARE N3', 'DUBAICARE N2', 'DUBAICARE EXCL N2', 'DUBAICARE N1', 'MEDNET SilkRoad', 'MEDNET Pearl', 'MEDNET Emerald', 'MEDNET Green', 'MEDNET Silver Classic', 'MEDNET Silver Premium', 'MEDNET Gold'] },
  { id: 'RAK', name: 'RAK', networks: ['NEXTCARE RN3', 'NEXTCARE RN2', 'NEXTCARE RN', 'NEXTCARE GN', 'NEXTCARE GN PLUS', 'MEDNET SilkRoad', 'MEDNET Pearl', 'MEDNET Emerald', 'MEDNET Green', 'MEDNET Silver Classic', 'MEDNET Silver Premium', 'MEDNET Gold', 'NAS VN', 'NAS WN', 'NAS SRN', 'NAS RN', 'NAS GN', 'NAS CN'] },
  { id: 'WATANIA_TAKAFUL_MANUAL', name: 'WATANIA TAKAFUL', networks: ['MEDNET SilkRoad', 'MEDNET Pearl', 'MEDNET Emerald', 'MEDNET Green', 'MEDNET Silver Classic', 'MEDNET Silver Premium', 'MEDNET Gold', 'NAS VN', 'NAS WN', 'NAS SRN', 'NAS RN', 'NAS GN', 'NAS CN'] },
  { id: 'QATAR_INSURANCE', name: 'QATAR INSURANCE', networks: ['NAS', 'MEDNET SilkRoad', 'MEDNET Pearl', 'MEDNET Emerald', 'MEDNET Green', 'MEDNET Silver Classic', 'MEDNET Silver Premium', 'MEDNET Gold'] }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
const calculateAge = (dob: string): number => {
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  // Standard age calculation
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  // Insurance age calculation: if past 6 months from last birthday, add 1 year
  // Calculate months since last birthday
  let monthsSinceLastBirthday = today.getMonth() - birthDate.getMonth();
  if (monthsSinceLastBirthday < 0) {
    monthsSinceLastBirthday += 12;
  }
  // Adjust for day of month
  if (today.getDate() < birthDate.getDate()) {
    monthsSinceLastBirthday--;
    if (monthsSinceLastBirthday < 0) monthsSinceLastBirthday += 12;
  }
  
  // If more than 6 months since birthday, consider next age
  if (monthsSinceLastBirthday >= 6) {
    age++;
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
  // Return 'NO_RATE' instead of null to include plan with 0 premium for manual editing
  return 'NO_RATE';
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function InsurancePortal() {
  // Family members
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([
    { id: 1, name: '', dob: '', gender: 'Male', sponsorship: 'Principal', relationship: 'Self', maternityEnabled: false }
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
  
  // Cloud plan edits (plan name, network, copay) - syncs across all users
  const [cloudPlanEdits, setCloudPlanEdits] = useState<{ [planId: string]: { plan?: string; network?: string; copay?: string } }>({});
  
  // LOCAL PERSISTENT EDITS - These survive page refresh (now member-specific: memberId_planId for premium only)
  const [localPlanEdits, setLocalPlanEdits] = useState<{ [memberPlanKey: string]: { plan?: string; network?: string; copay?: string; premium?: number } }>({});
  const [localBenefitsEdits, setLocalBenefitsEdits] = useState<{ [planId: string]: PlanBenefits }>({});
  
  // Manual plans
  const [manualPlans, setManualPlans] = useState<{ [key: string]: any[] }>({});
  const [showManualPlanModal, setShowManualPlanModal] = useState(false);
  const [currentProvider, setCurrentProvider] = useState('');
  const [newManualPlan, setNewManualPlan] = useState({ planName: '', network: '', copay: '', premium: '' });
  
  // Custom providers (user-added companies)
  const [customProviders, setCustomProviders] = useState<{ id: string; name: string; networks: string[] }[]>([]);
  const [showAddProviderModal, setShowAddProviderModal] = useState(false);
  const [newProviderName, setNewProviderName] = useState('');
  
  // Edit plan
  const [editingResultPlan, setEditingResultPlan] = useState<any>(null);
  const [showEditResultPlanModal, setShowEditResultPlanModal] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  
  // Report
  const [advisorComment, setAdvisorComment] = useState('');
  const [reportHistory, setReportHistory] = useState<any[]>([]);
  const [showReportHistory, setShowReportHistory] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // SEARCH FILTERS
  const [providerSearch, setProviderSearch] = useState(''); // Insurance Name
  const [planSearch, setPlanSearch] = useState(''); // Network (was Plan)
  const [networkSearch, setNetworkSearch] = useState(''); // TPA
  const [copaySearch, setCopaySearch] = useState(''); // Copay filter

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

    // Load custom providers from localStorage
    try {
      const savedCustomProviders = localStorage.getItem(STORAGE_KEYS.CUSTOM_PROVIDERS);
      if (savedCustomProviders) {
        setCustomProviders(JSON.parse(savedCustomProviders));
      }
    } catch (e) {
      console.error('Error loading custom providers:', e);
    }

    // Load cloud benefits and plan edits
    const loadCloudBenefits = async () => {
      try {
        const response = await fetch('/api/benefits');
        if (response.ok) {
          const data = await response.json();
          console.log('📥 Raw cloud data:', data);
          if (data.success && data.benefits) {
            const cleanBenefits: { [key: string]: PlanBenefits } = {};
            const cleanPlanEdits: { [key: string]: { plan?: string; network?: string; copay?: string } } = {};
            
            Object.keys(data.benefits).forEach(key => {
              const { _updatedAt, ...benefitData } = data.benefits[key];
              // Check if this is a plan edit (starts with PLAN_EDIT_ prefix OR has _isPlanEdit flag)
              if (key.startsWith('PLAN_EDIT_') || benefitData._isPlanEdit) {
                const { _isPlanEdit, ...editData } = benefitData;
                const planId = key.replace('PLAN_EDIT_', '');
                cleanPlanEdits[planId] = editData;
                console.log('📝 Loaded plan edit for:', planId, editData);
              } else {
                cleanBenefits[key] = benefitData as PlanBenefits;
              }
            });
            console.log('✅ Cloud plan edits loaded:', cleanPlanEdits);
            setCloudBenefits(cleanBenefits);
            setCloudPlanEdits(cleanPlanEdits);
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
            // Ensure each plan has benefits object
            const plansWithBenefits: { [key: string]: any[] } = {};
            Object.keys(data.plans).forEach(providerKey => {
              plansWithBenefits[providerKey] = data.plans[providerKey].map((plan: any) => ({
                ...plan,
                benefits: plan.benefits || defaultBenefits
              }));
            });
            setManualPlans(plansWithBenefits);
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
      if (history) {
        const parsed = JSON.parse(history);
        // Keep only last 10 entries to prevent quota issues
        if (parsed.length > 10) {
          const trimmed = parsed.slice(-10);
          localStorage.setItem(STORAGE_KEYS.REPORT_HISTORY, JSON.stringify(trimmed));
          setReportHistory(trimmed);
        } else {
          setReportHistory(parsed);
        }
      }
    } catch (e) {
      console.error('Error loading history:', e);
      // Clear corrupted history
      localStorage.removeItem(STORAGE_KEYS.REPORT_HISTORY);
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

  // Save custom providers to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_PROVIDERS, JSON.stringify(customProviders));
  }, [customProviders]);

  // Get plan benefits with local overrides
  const getPlanBenefits = (provider: string, planName: string, planId?: string): PlanBenefits => {
    // First check local edits (highest priority)
    if (planId && localBenefitsEdits[planId]) {
      return { ...localBenefitsEdits[planId] };
    }
    
    // Check cloud benefits by planId (for manual plans)
    if (planId && cloudBenefits[planId]) {
      return { ...cloudBenefits[planId] };
    }
    
    const planKey = `${provider}_${planName}`;
    if (cloudBenefits[planKey]) return { ...cloudBenefits[planKey] };
    if (PLAN_BENEFITS[planKey]) return { ...PLAN_BENEFITS[planKey] };
    
    // Check if it's a MEDNET plan - return MEDNET benefits
    if (planName.includes('MEDNET_') || provider.includes('_MEDNET')) {
      return { ...MEDNET_BENEFITS };
    }
    
    // Check if it's a NEXTCARE plan - return NEXTCARE benefits
    if (planName.includes('NEXTCARE_') || provider.includes('_NEXTCARE')) {
      return { ...NEXTCARE_BENEFITS };
    }
    
    // Check if it's a NAS plan - return NAS benefits
    if (planName.includes('NAS_') || provider.includes('_NAS')) {
      return { ...NAS_BENEFITS };
    }
    
    // Check partial matches
    const benefitKeys = Object.keys(PLAN_BENEFITS);
    for (const key of benefitKeys) {
      if (planName.includes(key.split('_').pop() || '')) {
        return { ...PLAN_BENEFITS[key] };
      }
    }
    
    return { ...defaultBenefits };
  };

  // Apply local plan edits to a plan (cloud edits for plan/network/copay, local for premium)
  const applyLocalEdits = (plan: InsurancePlan, memberId?: number): InsurancePlan => {
    // Cloud edits for plan name, network, copay (shared across all users)
    const cloudEdits = cloudPlanEdits[plan.id];
    
    // Member-specific key for premium only
    const memberPlanKey = memberId !== undefined ? `${memberId}_${plan.id}` : plan.id;
    const localEdits = localPlanEdits[memberPlanKey];
    
    // Check local edits first, then cloud benefits for benefits
    const benefitsEdits = localBenefitsEdits[plan.id] || cloudBenefits[plan.id];
    
    if (!cloudEdits && !localEdits && !benefitsEdits) return plan;
    
    return {
      ...plan,
      // Plan name, network, copay come from cloud edits (shared)
      plan: cloudEdits?.plan || plan.plan,
      network: cloudEdits?.network || plan.network,
      copay: cloudEdits?.copay || plan.copay,
      // Premium comes from local member-specific edits
      premium: localEdits?.premium !== undefined ? localEdits.premium : plan.premium,
      benefits: benefitsEdits || plan.benefits
    };
  };

  // Auto-update relationship when DOB changes
  const updateFamilyMember = (id: number, field: string, value: string | boolean) => {
    setFamilyMembers(prev => prev.map(m => {
      if (m.id !== id) return m;
      
      const updated = { ...m, [field]: value };
      
      // Auto-update relationship based on age
      if (field === 'dob' && typeof value === 'string' && value) {
        const age = calculateAge(value);
        updated.relationship = getAutoRelationship(age, updated.sponsorship);
      }
      if (field === 'sponsorship' && typeof value === 'string') {
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
      relationship: 'Other',
      maternityEnabled: false
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
    const providerName = MANUAL_PROVIDERS.find(p => p.id === currentProvider)?.name || customProviders.find(p => p.id === currentProvider)?.name || currentProvider;
    
    // Use appropriate benefits template based on network
    const networkUpper = (newManualPlan.network || '').toUpperCase();
    const isMednetNetwork = networkUpper.startsWith('MEDNET');
    const isNextcareNetwork = networkUpper.startsWith('NEXTCARE');
    const isNasNetwork = networkUpper.startsWith('NAS');
    let planBenefits = { ...defaultBenefits };
    if (isMednetNetwork) planBenefits = { ...MEDNET_BENEFITS };
    else if (isNextcareNetwork) planBenefits = { ...NEXTCARE_BENEFITS };
    else if (isNasNetwork) planBenefits = { ...NAS_BENEFITS };
    
    const plan: InsurancePlan = {
      id: `${currentProvider}_${Date.now()}`,
      provider: providerName,
      plan: newManualPlan.planName,
      network: newManualPlan.network || 'Standard',
      copay: newManualPlan.copay || 'Variable',
      premium: parseFloat(newManualPlan.premium),
      selected: false,
      status: 'none' as const,
      benefits: planBenefits,
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
            // Check if this is a valid rate or NO_RATE marker
            const hasValidRate = ageBand !== 'NO_RATE';
            let premium = 0;
            let needsManualRate = false;
            
            if (hasValidRate) {
              const rateData = plans[planName][ageBand];
              if (rateData && rateData[genderKey as 'M' | 'F']) {
                premium = rateData[genderKey as 'M' | 'F'];
              } else {
                needsManualRate = true;
              }
            } else {
              // No rate available for this age - show with 0 premium for manual entry
              needsManualRate = true;
            }
            
            let displayName = planName.replace(/_/g, ' ');
            let network = 'Standard';
            let copay = 'Variable';
              
              // Copay detection
              if (planName.endsWith('_0')) copay = '0%';
              else if (planName.endsWith('_10')) copay = '10%';
              else if (planName.endsWith('_20')) copay = '20%';
              
              // Network detection for MEDNET plans
              if (planName.includes('MEDNET_SILKROAD')) { network = 'MEDNET'; displayName = 'SilkRoad'; }
              else if (planName.includes('MEDNET_PEARL')) { network = 'MEDNET'; displayName = 'Pearl'; }
              else if (planName.includes('MEDNET_EMERALD')) { network = 'MEDNET'; displayName = 'Emerald'; }
              else if (planName.includes('MEDNET_GREEN')) { network = 'MEDNET'; displayName = 'Green'; }
              else if (planName.includes('MEDNET_SILVER_CLASSIC')) { network = 'MEDNET'; displayName = 'Silver Classic'; }
              else if (planName.includes('MEDNET_SILVER_PREMIUM')) { network = 'MEDNET'; displayName = 'Silver Premium'; }
              else if (planName.includes('MEDNET_GOLD')) { network = 'MEDNET'; displayName = 'Gold'; }
              // Network detection for NEXTCARE plans
              else if (planName.includes('NEXTCARE_PCP')) { network = 'NEXTCARE'; displayName = 'PCP'; }
              else if (planName.includes('NEXTCARE_RN3')) { network = 'NEXTCARE'; displayName = 'RN3'; }
              else if (planName.includes('NEXTCARE_RN2')) { network = 'NEXTCARE'; displayName = 'RN2'; }
              else if (planName.includes('NEXTCARE_RN_')) { network = 'NEXTCARE'; displayName = 'RN'; }
              else if (planName.includes('NEXTCARE_GN_LIMITED')) { network = 'NEXTCARE'; displayName = 'GN Limited'; }
              else if (planName.includes('NEXTCARE_GN_PLUS')) { network = 'NEXTCARE'; displayName = 'GN+'; }
              else if (planName.includes('NEXTCARE_GN_')) { network = 'NEXTCARE'; displayName = 'GN'; }
              // Network detection for NAS plans
              else if (planName.includes('NAS_VN_')) { network = 'NAS'; displayName = 'VN'; }
              else if (planName.includes('NAS_WN_')) { network = 'NAS'; displayName = 'WN'; }
              else if (planName.includes('NAS_SRN_')) { network = 'NAS'; displayName = 'SRN'; }
              else if (planName.includes('NAS_RN_')) { network = 'NAS'; displayName = 'RN'; }
              else if (planName.includes('NAS_GN_')) { network = 'NAS'; displayName = 'GN'; }
              else if (planName.includes('NAS_CN_')) { network = 'NAS'; displayName = 'CN'; }
              else if (planName.includes('MEDNET')) network = 'MEDNET';
              else if (planName.includes('NAS')) network = 'NAS';
              else if (planName.includes('NEXTCARE')) network = 'NEXTCARE';
              else if (provider === 'FIDELITY' && planName.includes('NE')) network = 'AAFIA TPA';
              else if (provider === 'UFIC') network = 'UFIC Network';
              else if (provider.includes('WATANIA') && !provider.includes('MEDNET') && !provider.includes('NAS')) network = 'NAS/Mednet TPA';
              else if (provider.includes('ORIENT') && !provider.includes('MEDNET') && !provider.includes('NEXTCARE')) network = 'Orient/Nextcare';
              else if (provider === 'TAKAFUL_EMARAT') network = 'NEXTCARE';
              
              // Get clean provider name (remove _MEDNET, _NEXTCARE, _NAS suffix)
              let cleanProviderName = provider.replace('_MEDNET', '').replace('_NEXTCARE', '').replace('_NAS', '').replace(/_/g, ' ');
              
              const planId = `${provider}_${planName}`;
              
              // Create base plan
              let basePlan: InsurancePlan = {
                id: planId,
                provider: cleanProviderName,
                plan: displayName,
                network,
                copay,
                premium,
                selected: false,
                status: 'none',
                benefits: getPlanBenefits(provider, planName, planId),
                planLocation: isDubaiPlan ? 'Dubai' : 'Northern Emirates',
                salaryCategory: planName.includes('_LSB') ? 'Below 4K' : planName.includes('_NLSB') ? 'Above 4K' : 'All',
                needsManualRate: needsManualRate
              };
              
              // Apply any local edits
              basePlan = applyLocalEdits(basePlan);
              
              memberPlans.push(basePlan);
          }
        });
      });

      // Add manual plans
      Object.keys(manualPlans).forEach(providerKey => {
        if (manualPlans[providerKey]) {
          manualPlans[providerKey].forEach(plan => {
            // Priority: 1. cloudBenefits (most up-to-date from API)
            //           2. plan.benefits (embedded in manual plan from cloud)
            //           3. defaultBenefits (fallback)
            const planBenefits = cloudBenefits[plan.id] || plan.benefits || { ...defaultBenefits };
            let manualPlan: InsurancePlan = { 
              ...plan, 
              selected: false, 
              status: 'none' as const,
              benefits: { ...defaultBenefits, ...planBenefits },
              isManual: true,
              providerKey: providerKey
            };
            manualPlan = applyLocalEdits(manualPlan);
            memberPlans.push(manualPlan);
          });
        }
      });

      // Sort plans: first by whether they have rates, then by premium
      // Plans with N/A rates (needsManualRate && premium === 0) go to the end
      memberPlans.sort((a, b) => {
        const aIsNA = a.needsManualRate && a.premium === 0;
        const bIsNA = b.needsManualRate && b.premium === 0;
        // If one is N/A and the other isn't, N/A goes to the end
        if (aIsNA && !bIsNA) return 1;
        if (!aIsNA && bIsNA) return -1;
        // Otherwise sort by premium
        return a.premium - b.premium;
      });

      // Calculate min/max/avg only from plans with actual premiums (excluding N/A plans)
      const plansWithRates = memberPlans.filter(p => !(p.needsManualRate && p.premium === 0));
      newMemberResults[member.id] = {
        member,
        age,
        comparison: memberPlans,
        minPrice: plansWithRates.length > 0 ? Math.min(...plansWithRates.map(r => r.premium)) : 0,
        maxPrice: plansWithRates.length > 0 ? Math.max(...plansWithRates.map(r => r.premium)) : 0,
        avgPrice: plansWithRates.length > 0 ? plansWithRates.reduce((sum, r) => sum + r.premium, 0) / plansWithRates.length : 0
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
          item.id === planId ? { ...item, status: status as 'none' | 'renewal' | 'alternative' | 'recommended' } : item
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
              status: selectedPlanIds.includes(plan.id) ? (selectedStatuses[plan.id] as 'none' | 'renewal' | 'alternative' | 'recommended') : plan.status
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
    // Check cloud edits for plan/network/copay (shared across all users)
    const cloudEdits = cloudPlanEdits[planId];
    // Check local edits for premium (member-specific)
    const memberPlanKey = `${memberId}_${planId}`;
    const localEdits = localPlanEdits[memberPlanKey];
    setEditingResultPlan({ 
      ...plan, 
      // Plan name, network, copay from cloud edits (shared)
      plan: cloudEdits?.plan || plan.plan,
      network: cloudEdits?.network || plan.network,
      copay: cloudEdits?.copay || plan.copay,
      // Premium from local edits (member-specific)
      premium: localEdits?.premium !== undefined ? localEdits.premium : plan.premium
    });
    setEditingMemberId(memberId);
    setShowEditResultPlanModal(true);
  };

  // Save edited result plan (cloud for plan/network/copay, local for premium)
  const saveEditedResultPlan = async () => {
    if (!editingResultPlan || !editingResultPlan.plan || !editingResultPlan.premium) {
      alert('Please enter plan name and premium');
      return;
    }
    
    if (editingMemberId === null) {
      alert('Error: Member ID not found');
      return;
    }
    
    const planId = editingResultPlan.id;
    const memberPlanKey = `${editingMemberId}_${planId}`;
    
    // Cloud data for plan name, network, copay (shared across all users)
    const cloudEditData = {
      plan: editingResultPlan.plan,
      network: editingResultPlan.network || 'Standard',
      copay: editingResultPlan.copay || 'Variable'
    };
    
    // Local data for premium only (member-specific)
    const premiumValue = parseFloat(editingResultPlan.premium);

    // Save premium to localStorage with member-specific key
    setLocalPlanEdits(prev => ({
      ...prev,
      [memberPlanKey]: { premium: premiumValue }
    }));
    
    // Update cloudPlanEdits state immediately
    setCloudPlanEdits(prev => ({ ...prev, [planId]: cloudEditData }));

    // Update current session state for ALL members with this plan (for plan/network/copay)
    // But only update premium for the current member
    setMemberResults(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(mKey => {
        const mId = parseInt(mKey);
        updated[mId] = {
          ...updated[mId],
          comparison: updated[mId].comparison.map((item: any) =>
            item.id === planId ? {
              ...item,
              // Plan name, network, copay apply to all members
              plan: cloudEditData.plan,
              network: cloudEditData.network,
              copay: cloudEditData.copay,
              // Premium only changes for the current member being edited
              premium: mId === editingMemberId ? premiumValue : item.premium
            } : item
          )
        };
      });
      return updated;
    });

    // Save plan/network/copay to cloud using the existing benefits API with a prefix
    try {
      const savePayload = { 
        planKey: `PLAN_EDIT_${planId}`, 
        benefits: { ...cloudEditData, _isPlanEdit: true } 
      };
      console.log('📤 Saving plan edit to cloud:', savePayload);
      
      const response = await fetch('/api/benefits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savePayload)
      });
      
      const result = await response.json();
      console.log('📥 Save response:', result);
      
      if (result.success) {
        alert('✅ Plan details (name, network, copay) saved to cloud! Premium updated for this member only.');
      } else {
        alert('⚠️ Save may have failed. Check console for details.');
      }
    } catch (error) {
      console.error('Error saving plan edits to cloud:', error);
      alert('❌ Cloud sync failed! Changes saved locally only.');
    }

    setShowEditResultPlanModal(false);
    setEditingResultPlan(null);
    setEditingMemberId(null);
  };

  // Toggle benefits panel
  const toggleBenefitsPanel = (memberId: number, planId: string) => {
    const key = `${memberId}_${planId}`;
    const newShowState = !showBenefits[key];
    setShowBenefits(prev => ({ ...prev, [key]: newShowState }));
    if (newShowState) {
      const plan = memberResults[memberId].comparison.find(p => p.id === planId);
      if (plan) {
        // Priority: localBenefitsEdits > cloudBenefits > plan.benefits
        const existingBenefits = localBenefitsEdits[planId] || cloudBenefits[planId] || plan.benefits;
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

  // Update benefits - NOW SAVES TO LOCALSTORAGE AND CLOUD FOR PERSISTENCE
  const updateBenefits = async (memberId: number, planId: string) => {
    const key = `${memberId}_${planId}`;
    const updatedBenefits = editingBenefits[key];
    if (!updatedBenefits) return;
    
    // Find the plan to check if it's a manual plan
    const plan = memberResults[memberId]?.comparison.find(p => p.id === planId);
    const isManualPlan = plan?.isManual;
    const providerKey = plan?.providerKey;
    
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
    
    // Update cloudBenefits state immediately
    setCloudBenefits(prev => ({ ...prev, [planId]: updatedBenefits }));
    
    // If it's a manual plan, update the manual plan object in state and cloud
    if (isManualPlan && providerKey) {
      // Use functional update to get latest manualPlans state
      setManualPlans(prevManualPlans => {
        const updatedManualPlans = {
          ...prevManualPlans,
          [providerKey]: prevManualPlans[providerKey]?.map(p => 
            p.id === planId ? { ...p, benefits: { ...updatedBenefits } } : p
          ) || []
        };
        
        // Save updated manual plans to cloud (async, don't await inside setState)
        fetch('/api/manual-plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plans: updatedManualPlans })
        }).catch(error => console.error('Error saving manual plan benefits to cloud:', error));
        
        return updatedManualPlans;
      });
    }
    
    // Also save to benefits cloud endpoint (for all plans)
    try {
      await fetch('/api/benefits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey: planId, benefits: updatedBenefits })
      });
      alert('✅ Benefits saved! Changes will sync to all users.');
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
    try {
      // Store only essential data - selected plans AND plans with status
      const minimalMemberResults: { [key: number]: any } = {};
      Object.keys(memberResults).forEach(key => {
        const memberId = parseInt(key);
        const result = memberResults[memberId];
        minimalMemberResults[memberId] = {
          age: result.age,
          comparison: result.comparison.filter(p => p.selected || p.status !== 'none').map(p => ({
            id: p.id,
            provider: p.provider,
            plan: p.plan,
            network: p.network,
            copay: p.copay,
            premium: p.premium,
            selected: p.selected,
            status: p.status,
            isManual: p.isManual,
            providerKey: p.providerKey
          }))
        };
      });

      const reportState = {
        id: Date.now(),
        name: reportName,
        timestamp: new Date().toISOString(),
        familyMembers: familyMembers.map(m => ({ 
          id: m.id, 
          name: m.name, 
          dob: m.dob, 
          gender: m.gender, 
          relationship: m.relationship, 
          sponsorship: m.sponsorship,
          maternityEnabled: m.maternityEnabled 
        })),
        sharedSettings,
        memberResults: minimalMemberResults,
        advisorComment,
        manualPlans // Save manual plans so they can be restored
      };
      
      // Keep only last 10 reports to prevent quota issues
      let history = [...reportHistory, reportState];
      if (history.length > 10) {
        history = history.slice(-10);
      }
      
      localStorage.setItem(STORAGE_KEYS.REPORT_HISTORY, JSON.stringify(history));
      setReportHistory(history);
    } catch (e) {
      console.error('Failed to save report history:', e);
      // If quota exceeded, clear old history and try again
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        try {
          localStorage.removeItem(STORAGE_KEYS.REPORT_HISTORY);
          setReportHistory([]);
        } catch (clearError) {
          console.error('Failed to clear history:', clearError);
        }
      }
    }
  };

  // Load from history
  const loadReportFromHistory = (reportId: number) => {
    const report = reportHistory.find(r => r.id === reportId);
    if (!report) return;
    
    // Restore family members with all needed properties
    const restoredMembers = report.familyMembers.map((m: any) => ({
      ...m,
      maternityEnabled: m.maternityEnabled || false
    }));
    
    setFamilyMembers(restoredMembers);
    setSharedSettings(report.sharedSettings);
    setAdvisorComment(report.advisorComment || '');
    setManualPlans(report.manualPlans || {});
    
    // Store the selected plan IDs and their statuses from history for later restoration
    const savedSelections: { [memberId: number]: { [planId: string]: { selected: boolean; status: string } } } = {};
    if (report.memberResults) {
      Object.keys(report.memberResults).forEach(key => {
        const memberId = parseInt(key);
        savedSelections[memberId] = {};
        const comparison = report.memberResults[memberId]?.comparison || [];
        comparison.forEach((p: any) => {
          if (p.selected || p.status !== 'none') {
            savedSelections[memberId][p.id] = { selected: p.selected, status: p.status || 'none' };
          }
        });
      });
    }
    
    // Clear current results first
    setMemberResults({});
    setShowReportHistory(false);
    
    // Wait a moment for state to update, then trigger search and restore selections
    setTimeout(() => {
      // Trigger search
      const isDubai = report.sharedSettings?.location === 'Dubai';
      const isBelowSalary = report.sharedSettings?.salaryCategory === 'below4000';
      const newMemberResults: { [key: number]: MemberResult } = {};

      restoredMembers.forEach((member: FamilyMember) => {
        const age = calculateAge(member.dob);
        if (age < 0 || age > 100) return;

        const genderKey = member.gender === 'Male' ? 'M' : 'F';
        const memberPlans: InsurancePlan[] = [];

        Object.keys(INSURANCE_DB).forEach(provider => {
          const plans = INSURANCE_DB[provider];
          
          Object.keys(plans).forEach(planName => {
            const isNEPlan = planName.includes('_NE') || planName.startsWith('NE_') || planName.includes('NEMED');
            const isDubaiPlan = planName.includes('_DXB') || planName.includes('DMED') || planName.includes('EMED') || planName.includes('IMED') || planName.includes('DUBAI');
            
            if (isDubaiPlan && !isDubai) return;
            if (isNEPlan && isDubai) return;
            
            if (provider === 'ORIENT') {
              const isLSB = planName.includes('_LSB');
              const isNLSB = planName.includes('_NLSB') || planName === 'IMED_DXB';
              
              if (member.sponsorship === 'Principal') {
                if (isBelowSalary && isNLSB) return;
                if (!isBelowSalary && isLSB) return;
              } else {
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
                
                if (planName.endsWith('_0')) copay = '0%';
                else if (planName.endsWith('_10')) copay = '10%';
                else if (planName.endsWith('_20')) copay = '20%';
                
                if (planName.includes('MEDNET_SILKROAD')) { network = 'MEDNET'; displayName = 'SilkRoad'; }
                else if (planName.includes('MEDNET_PEARL')) { network = 'MEDNET'; displayName = 'Pearl'; }
                else if (planName.includes('MEDNET_EMERALD')) { network = 'MEDNET'; displayName = 'Emerald'; }
                else if (planName.includes('MEDNET_GREEN')) { network = 'MEDNET'; displayName = 'Green'; }
                else if (planName.includes('MEDNET_SILVER_CLASSIC')) { network = 'MEDNET'; displayName = 'Silver Classic'; }
                else if (planName.includes('MEDNET_SILVER_PREMIUM')) { network = 'MEDNET'; displayName = 'Silver Premium'; }
                else if (planName.includes('MEDNET_GOLD')) { network = 'MEDNET'; displayName = 'Gold'; }
                else if (planName.includes('NEXTCARE_PCP')) { network = 'NEXTCARE'; displayName = 'PCP'; }
                else if (planName.includes('NEXTCARE_RN3')) { network = 'NEXTCARE'; displayName = 'RN3'; }
                else if (planName.includes('NEXTCARE_RN2')) { network = 'NEXTCARE'; displayName = 'RN2'; }
                else if (planName.includes('NEXTCARE_RN_')) { network = 'NEXTCARE'; displayName = 'RN'; }
                else if (planName.includes('NEXTCARE_GN_LIMITED')) { network = 'NEXTCARE'; displayName = 'GN Limited'; }
                else if (planName.includes('NEXTCARE_GN_PLUS')) { network = 'NEXTCARE'; displayName = 'GN+'; }
                else if (planName.includes('NEXTCARE_GN_')) { network = 'NEXTCARE'; displayName = 'GN'; }
                else if (planName.includes('NAS_VN_')) { network = 'NAS'; displayName = 'VN'; }
                else if (planName.includes('NAS_WN_')) { network = 'NAS'; displayName = 'WN'; }
                else if (planName.includes('NAS_SRN_')) { network = 'NAS'; displayName = 'SRN'; }
                else if (planName.includes('NAS_RN_')) { network = 'NAS'; displayName = 'RN'; }
                else if (planName.includes('NAS_GN_')) { network = 'NAS'; displayName = 'GN'; }
                else if (planName.includes('NAS_CN_')) { network = 'NAS'; displayName = 'CN'; }
                else if (planName.includes('MEDNET')) network = 'MEDNET';
                else if (planName.includes('NAS')) network = 'NAS';
                else if (planName.includes('NEXTCARE')) network = 'NEXTCARE';
                else if (provider === 'FIDELITY' && planName.includes('NE')) network = 'AAFIA TPA';
                else if (provider === 'UFIC') network = 'UFIC Network';
                else if (provider.includes('WATANIA') && !provider.includes('MEDNET') && !provider.includes('NAS')) network = 'NAS/Mednet TPA';
                else if (provider.includes('ORIENT') && !provider.includes('MEDNET') && !provider.includes('NEXTCARE')) network = 'Orient/Nextcare';
                else if (provider === 'TAKAFUL_EMARAT') network = 'NEXTCARE';
                
                let cleanProviderName = provider.replace('_MEDNET', '').replace('_NEXTCARE', '').replace('_NAS', '').replace(/_/g, ' ');
                
                const planId = `${provider}_${planName}`;
                
                // Check if this plan was selected/had status in history
                const savedPlanState = savedSelections[member.id]?.[planId];
                
                let basePlan: InsurancePlan = {
                  id: planId,
                  provider: cleanProviderName,
                  plan: displayName,
                  network,
                  copay,
                  premium,
                  selected: savedPlanState?.selected || false,
                  status: (savedPlanState?.status as 'none' | 'renewal' | 'alternative' | 'recommended') || 'none',
                  benefits: getPlanBenefits(provider, planName, planId),
                  planLocation: isDubaiPlan ? 'Dubai' : 'Northern Emirates',
                  salaryCategory: planName.includes('_LSB') ? 'Below 4K' : planName.includes('_NLSB') ? 'Above 4K' : 'All'
                };
                
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
              const planBenefits = cloudBenefits[plan.id] || plan.benefits || { ...defaultBenefits };
              const savedPlanState = savedSelections[member.id]?.[plan.id];
              let manualPlan: InsurancePlan = { 
                ...plan, 
                selected: savedPlanState?.selected || false, 
                status: (savedPlanState?.status as 'none' | 'renewal' | 'alternative' | 'recommended') || 'none',
                benefits: { ...defaultBenefits, ...planBenefits },
                isManual: true,
                providerKey: providerKey
              };
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
      restoredMembers.forEach((m: FamilyMember) => { initialExpanded[m.id] = true; });
      setExpandedMembers(initialExpanded);
      
      alert('✅ Report loaded successfully with all comparisons restored!');
    }, 100);
  };

  // Delete from history
  const deleteReportFromHistory = (reportId: number) => {
    if (!window.confirm('Delete this report from history?')) return;
    try {
      const history = reportHistory.filter(r => r.id !== reportId);
      localStorage.setItem(STORAGE_KEYS.REPORT_HISTORY, JSON.stringify(history));
      setReportHistory(history);
    } catch (e) {
      console.error('Failed to delete from history:', e);
    }
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
      const copayMatch = !copaySearch || 
        plan.copay.toLowerCase().includes(copaySearch.toLowerCase());
      return providerMatch && planMatch && networkMatch && copayMatch;
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

  // Get unique copays for suggestions
  const getUniqueCopays = (): string[] => {
    const copays = new Set<string>();
    Object.keys(memberResults).forEach(key => {
      memberResults[parseInt(key)].comparison.forEach(plan => {
        copays.add(plan.copay);
      });
    });
    return Array.from(copays).sort();
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
    
    try {
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

    // Get the plan details - search across ALL members to find the plan
    const selectedPlans = Array.from(allSelectedPlanIds).map(planId => {
      // Try to find the plan in any member's results
      for (const m of allMembersWithSelections) {
        const memberResult = memberResults[m.member.id];
        const plan = memberResult?.comparison.find(p => p.id === planId);
        if (plan) return plan;
      }
      return null;
    }).filter(Boolean) as InsurancePlan[];
    
    // Sort: renewals first, then by premium (lowest first)
    selectedPlans.sort((a, b) => {
      // Renewals come first
      if (a.status === 'renewal' && b.status !== 'renewal') return -1;
      if (b.status === 'renewal' && a.status !== 'renewal') return 1;
      // Then sort by premium
      return a.premium - b.premium;
    });

    const numPlans = selectedPlans.length;
    const numMembers = allMembersWithSelections.length;

    // Calculate totals per plan (sum across all members) with detailed breakdown
    const planTotals: { [planId: string]: number } = {};
    const planGrossPremiums: { [planId: string]: number } = {}; // Sum of all member premiums
    const planBasmahTotals: { [planId: string]: number } = {}; // Basmah × number of members
    const planVatTotals: { [planId: string]: number } = {}; // 5% of (Gross + Basmah)
    
    const isDubai = sharedSettings.location === 'Dubai';
    const basmaFeePerPerson = isDubai ? 37 : 24; // Dubai = 37, Northern Emirates = 24
    const vatRate = 0.05; // 5% VAT
    
    selectedPlans.forEach(plan => {
      let grossPremium = 0;
      let memberCount = 0;
      
      allMembersWithSelections.forEach(m => {
        const memberResult = memberResults[m.member.id];
        const memberPlan = memberResult?.comparison.find(p => p.id === plan.id);
        if (memberPlan) {
          grossPremium += memberPlan.premium;
          memberCount++;
        }
      });
      
      const basmahTotal = basmaFeePerPerson * memberCount;
      const vatAmount = (grossPremium + basmahTotal) * vatRate;
      const grandTotal = grossPremium + basmahTotal + vatAmount;
      
      planGrossPremiums[plan.id] = grossPremium;
      planBasmahTotals[plan.id] = basmahTotal;
      planVatTotals[plan.id] = vatAmount;
      planTotals[plan.id] = grandTotal;
    });
    
    // For Basmah label
    const memberCount = allMembersWithSelections.length;

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
              ${plan.status === 'alternative' ? '<div class="tag tag-alternative">ALTERNATIVE</div>' : ''}
              ${plan.status === 'recommended' ? '<div class="tag tag-recommended">RECOMMENDED</div>' : ''}
            </th>
          `).join('')}
        </tr>
      </thead>
      <tbody>
        <tr><td class="cell-label">Plan Name</td>${selectedPlans.map(p => `<td class="cell-value">${p.plan || '-'}</td>`).join('')}</tr>
        <tr class="row-alt"><td class="cell-label">Area of Cover</td>${selectedPlans.map(p => `<td class="cell-value">${p.benefits?.areaOfCover || '-'}</td>`).join('')}</tr>
        <tr><td class="cell-label">Annual Limit</td>${selectedPlans.map(p => `<td class="cell-value">${p.benefits?.annualLimit || '-'}</td>`).join('')}</tr>
        <tr class="row-alt"><td class="cell-label">Network</td>${selectedPlans.map(p => `<td class="cell-value">${p.benefits?.network || p.network || '-'}</td>`).join('')}</tr>
        <tr><td class="cell-label">Consultation Deductible</td>${selectedPlans.map(p => `<td class="cell-detail">${p.benefits?.consultationDeductible || '-'}</td>`).join('')}</tr>
        <tr class="row-alt"><td class="cell-label">Prescribed Drugs & Medicines</td>${selectedPlans.map(p => `<td class="cell-detail">${p.benefits?.prescribedDrugs || '-'}</td>`).join('')}</tr>
        <tr><td class="cell-label">Diagnostics</td>${selectedPlans.map(p => `<td class="cell-detail">${p.benefits?.diagnostics || '-'}</td>`).join('')}</tr>
        <tr class="row-alt"><td class="cell-label">Pre-existing Condition</td>${selectedPlans.map(p => `<td class="cell-detail">${p.benefits?.preexistingCondition || '-'}</td>`).join('')}</tr>
        <tr><td class="cell-label">Physiotherapy</td>${selectedPlans.map(p => `<td class="cell-detail">${p.benefits?.physiotherapy || '-'}</td>`).join('')}</tr>
        <tr class="row-alt"><td class="cell-label">Out-patient Maternity</td>${selectedPlans.map(p => {
          const anyMaternityEnabled = allMembersWithSelections.some(m => m.member.maternityEnabled);
          return `<td class="cell-detail">${anyMaternityEnabled ? (p.benefits?.outpatientMaternity || '-') : '-'}</td>`;
        }).join('')}</tr>
        <tr><td class="cell-label">In-patient Maternity</td>${selectedPlans.map(p => {
          const anyMaternityEnabled = allMembersWithSelections.some(m => m.member.maternityEnabled);
          return `<td class="cell-detail">${anyMaternityEnabled ? (p.benefits?.inpatientMaternity || '-') : '-'}</td>`;
        }).join('')}</tr>
        <tr class="row-alt"><td class="cell-label">Dental</td>${selectedPlans.map(p => `<td class="cell-detail">${p.benefits?.dental?.enabled ? (p.benefits.dental.value || 'Covered') : 'Not Covered'}</td>`).join('')}</tr>
        <tr><td class="cell-label">Optical</td>${selectedPlans.map(p => `<td class="cell-detail">${p.benefits?.optical?.enabled ? (p.benefits.optical.value || 'Covered') : 'Not Covered'}</td>`).join('')}</tr>
        <tr class="row-alt"><td class="cell-label">Alternative Medicine</td>${selectedPlans.map(p => `<td class="cell-detail">${p.benefits?.alternativeMedicine?.enabled ? (p.benefits.alternativeMedicine.value || 'Covered') : 'Not Covered'}</td>`).join('')}</tr>
        ${allMembersWithSelections.map((m, idx) => `
          <tr class="row-member">
            <td class="cell-label">${m.member.name || m.member.relationship} (${m.age}y)</td>
            ${selectedPlans.map(plan => {
              const memberResult = memberResults[m.member.id];
              const memberPlan = memberResult?.comparison.find(p => p.id === plan.id);
              if (memberPlan) {
                return `<td class="cell-premium">AED ${memberPlan.premium.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</td>`;
              }
              return `<td class="cell-premium">-</td>`;
            }).join('')}
          </tr>
        `).join('')}
        <tr class="row-subtotal">
          <td class="cell-subtotal-label">Gross Premium (Excluding Basmah & VAT)</td>
          ${selectedPlans.map(plan => `<td class="cell-subtotal-value">AED ${(planGrossPremiums[plan.id] || 0).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</td>`).join('')}
        </tr>
        <tr class="row-subtotal">
          <td class="cell-subtotal-label">Basmah (@ ${basmaFeePerPerson}/- Per Person)${isDubai ? ' (DXB visa holders only)' : ' (NE visa holders)'}</td>
          ${selectedPlans.map(plan => `<td class="cell-subtotal-value">AED ${(planBasmahTotals[plan.id] || 0).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</td>`).join('')}
        </tr>
        <tr class="row-subtotal">
          <td class="cell-subtotal-label">VAT (5%)</td>
          ${selectedPlans.map(plan => `<td class="cell-subtotal-value">AED ${(planVatTotals[plan.id] || 0).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</td>`).join('')}
        </tr>
        <tr class="row-total">
          <td class="cell-total-label">Grand Total</td>
          ${selectedPlans.map(plan => `<td class="cell-total-value">AED ${(planTotals[plan.id] || 0).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</td>`).join('')}
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
    
    .row-subtotal { background: #e0f2fe; }
    .cell-subtotal-label {
      text-align: left !important;
      font-weight: 600;
      color: #0369a1;
      background: #bae6fd !important;
      font-size: 8px;
      padding: 4px 8px !important;
    }
    .cell-subtotal-value {
      font-weight: 600;
      color: #0284c7;
      font-size: 9px;
      background: #e0f2fe;
      text-align: center !important;
      vertical-align: middle !important;
      padding: 4px 8px !important;
    }
    
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
      font-size: 7px;
      font-weight: bold;
      margin-top: 2px;
    }
    .tag-renewal { background: #fbbf24; color: #78350f; }
    .tag-alternative { background: #8b5cf6; color: white; }
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

    // Use iframe approach - doesn't get blocked by browsers
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(reportHTML);
      iframeDoc.close();
      
      // Wait for content and images to load then print
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        // Remove iframe after printing dialog closes
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      }, 800);
    }

    // Upload to cloud (non-blocking)
    fetch('/api/upload-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ htmlContent: reportHTML, fileName, metadata: { clientName, location: sharedSettings.location } })
    }).catch(e => console.error('Cloud upload failed:', e));
    
    } catch (generateError) {
      console.error('Report generation error:', generateError);
      alert('Error generating report: ' + (generateError instanceof Error ? generateError.message : 'Unknown error'));
    }
    
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
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
                    <label className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-pink-50 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={member.maternityEnabled || false} 
                        onChange={(e) => updateFamilyMember(member.id, 'maternityEnabled', e.target.checked)}
                        className="w-4 h-4 text-pink-600"
                      />
                      <span className="text-sm text-pink-800">🤰 Maternity</span>
                    </label>
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
              <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <span className="text-sm text-green-700">
                  💾 {Object.keys(localPlanEdits).length} plan edits and {Object.keys(localBenefitsEdits).length} benefits edits saved locally
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Manual Plan Entry */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">✍️ Manual Plan Entry</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {/* Predefined providers */}
            {MANUAL_PROVIDERS.map(provider => (
              <button key={provider.id} onClick={() => { setCurrentProvider(provider.id); setShowManualPlanModal(true); }} className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium">➕ {provider.name}</button>
            ))}
            {/* Custom providers added by user */}
            {customProviders.map(provider => (
              <button key={provider.id} onClick={() => { setCurrentProvider(provider.id); setShowManualPlanModal(true); }} className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium">➕ {provider.name}</button>
            ))}
            {/* Add new provider button */}
            <button onClick={() => setShowAddProviderModal(true)} className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-medium border-2 border-dashed border-gray-400">➕ Add Company</button>
          </div>
          {/* Show count of manual plans saved */}
          {Object.keys(manualPlans).some(key => manualPlans[key]?.length > 0) && (
            <div className="mt-3 p-2 bg-green-50 rounded-lg border border-green-200 text-sm text-green-700">
              💾 {Object.values(manualPlans).flat().length} manual plan(s) saved. Click "Search Plans" to see them in results.
            </div>
          )}
        </div>

        {/* Add New Provider Modal */}
        {showAddProviderModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full m-4">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Add New Insurance Company</h3>
              <div className="space-y-4">
                <input 
                  type="text" 
                  placeholder="Company Name *" 
                  value={newProviderName} 
                  onChange={(e) => setNewProviderName(e.target.value.toUpperCase())} 
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <p className="text-sm text-gray-500">You can add networks when adding plans for this company.</p>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => { setShowAddProviderModal(false); setNewProviderName(''); }} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button 
                  onClick={() => {
                    if (!newProviderName.trim()) {
                      alert('Please enter company name');
                      return;
                    }
                    const newProvider = {
                      id: `CUSTOM_${Date.now()}`,
                      name: newProviderName.trim(),
                      networks: ['MEDNET', 'NEXTCARE', 'NAS', 'Custom Network']
                    };
                    setCustomProviders(prev => [...prev, newProvider]);
                    setShowAddProviderModal(false);
                    setNewProviderName('');
                    alert('✅ Company added! You can now add plans for ' + newProvider.name);
                  }} 
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                >
                  Add Company
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manual Plan Modal */}
        {showManualPlanModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full m-4">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Add {MANUAL_PROVIDERS.find(p => p.id === currentProvider)?.name || customProviders.find(p => p.id === currentProvider)?.name} Plan</h3>
              <div className="space-y-4">
                <input type="text" placeholder="Plan Name *" value={newManualPlan.planName} onChange={(e) => setNewManualPlan({ ...newManualPlan, planName: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
                <select value={newManualPlan.network} onChange={(e) => setNewManualPlan({ ...newManualPlan, network: e.target.value })} className="w-full px-4 py-2 border rounded-lg">
                  <option value="">Select Network</option>
                  {(MANUAL_PROVIDERS.find(p => p.id === currentProvider)?.networks || customProviders.find(p => p.id === currentProvider)?.networks || []).map(network => (
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

            {/* SEARCH FILTERS FOR INSURER, TPA, NETWORK AND COPAY */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4 p-4 bg-gray-50 rounded-lg border">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🏢 Insurer Name</label>
                <input
                  type="text"
                  value={providerSearch}
                  onChange={(e) => setProviderSearch(e.target.value)}
                  placeholder="Filter by insurer..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  list="provider-suggestions"
                />
                <datalist id="provider-suggestions">
                  {getUniqueProviders().map(p => <option key={p} value={p} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🌐 TPA</label>
                <input
                  type="text"
                  value={networkSearch}
                  onChange={(e) => setNetworkSearch(e.target.value)}
                  placeholder="Filter by TPA..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  list="network-suggestions"
                />
                <datalist id="network-suggestions">
                  {getUniqueNetworks().map(n => <option key={n} value={n} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">📋 Network</label>
                <input
                  type="text"
                  value={planSearch}
                  onChange={(e) => setPlanSearch(e.target.value)}
                  placeholder="Filter by network..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  list="plan-suggestions"
                />
                <datalist id="plan-suggestions">
                  {getUniquePlans().map(p => <option key={p} value={p} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">💵 Copay</label>
                <input
                  type="text"
                  value={copaySearch}
                  onChange={(e) => setCopaySearch(e.target.value)}
                  placeholder="Filter by copay..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  list="copay-suggestions"
                />
                <datalist id="copay-suggestions">
                  {getUniqueCopays().map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => { setProviderSearch(''); setPlanSearch(''); setNetworkSearch(''); setCopaySearch(''); }}
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
              const naPlansCount = results.comparison.filter(p => p.needsManualRate && p.premium === 0).length;
              
              return (
                <div key={member.id} className="mb-6 border-2 border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-orange-100 to-blue-100 cursor-pointer" onClick={() => setExpandedMembers(prev => ({ ...prev, [member.id]: !prev[member.id] }))}>
                    <div>
                      <h3 className="font-bold text-gray-800">
                        {member.name || `Member ${memberIdx + 1}`} ({member.relationship})
                        {results.age > 65 && <span className="ml-2 px-2 py-0.5 bg-amber-200 text-amber-800 text-xs rounded-full">65+</span>}
                      </h3>
                      <p className="text-sm text-gray-600">Age: {results.age} | {member.gender} | {member.sponsorship}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-blue-600">{filteredPlans.length} plans</span>
                      {naPlansCount > 0 && <span className="text-sm font-medium text-amber-600">{naPlansCount} N/A</span>}
                      <span className="text-sm font-medium text-green-600">{selectedCount} selected</span>
                      <span className="text-2xl">{expandedMembers[member.id] ? '▼' : '▶'}</span>
                    </div>
                  </div>

                  {expandedMembers[member.id] && (
                    <div className="p-4">
                      {/* Age 65+ Warning Banner */}
                      {results.age > 65 && naPlansCount > 0 && (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg">
                          <p className="text-amber-800 text-sm">
                            <strong>⚠️ Age 65+ Notice:</strong> {naPlansCount} plans show "N/A" because they don't have standard rates for this age group.
                            You can manually edit the premium by clicking the ✏️ button next to "N/A". Plans with rates: UFIC, ORIENT Basic, WATANIA NE.
                          </p>
                        </div>
                      )}
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
                              <th className="p-2 text-left">Insurer Name</th>
                              <th className="p-2 text-left">TPA</th>
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
                              const memberPlanKey = `${member.id}_${plan.id}`;
                              // Check for cloud edits (plan/network/copay) and local edits (premium)
                              const hasCloudEdits = cloudPlanEdits[plan.id];
                              const hasLocalPremiumEdit = localPlanEdits[memberPlanKey]?.premium !== undefined;
                              const hasBenefitsEdits = localBenefitsEdits[plan.id] || cloudBenefits[plan.id];
                              const hasAnyEdits = hasCloudEdits || hasLocalPremiumEdit || hasBenefitsEdits;
                              
                              // Apply cloud edits for plan/network/copay, local edits for premium
                              const displayPlan = {
                                ...plan,
                                // Cloud edits for plan name, network, copay (shared across all users)
                                plan: cloudPlanEdits[plan.id]?.plan || plan.plan,
                                network: cloudPlanEdits[plan.id]?.network || plan.network,
                                copay: cloudPlanEdits[plan.id]?.copay || plan.copay,
                                // Local edits for premium (member-specific)
                                premium: localPlanEdits[memberPlanKey]?.premium !== undefined ? localPlanEdits[memberPlanKey].premium : plan.premium
                              };
                              
                              return (
                                <React.Fragment key={plan.id}>
                                  <tr className={`border-b hover:bg-gray-50 ${plan.selected ? 'bg-green-50' : ''} ${hasAnyEdits ? 'border-l-4 border-l-blue-500' : ''} ${plan.isManual ? 'border-l-4 border-l-purple-500' : ''}`}>
                                    <td className="p-2"><input type="checkbox" checked={plan.selected} onChange={() => togglePlanSelection(member.id, plan.id)} className="w-4 h-4" /></td>
                                    <td className="p-2">
                                      {actualRank <= 3 ? (
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${actualRank === 1 ? 'bg-yellow-400 text-yellow-800' : actualRank === 2 ? 'bg-gray-300 text-gray-700' : 'bg-orange-300 text-orange-800'}`}>#{actualRank}</span>
                                      ) : actualRank}
                                    </td>
                                    <td className="p-2 font-medium">
                                      {displayPlan.provider}
                                      {plan.isManual && <span className="ml-1 px-1 py-0.5 bg-purple-100 text-purple-600 text-xs rounded">Manual</span>}
                                      {plan.needsManualRate && !localPlanEdits[memberPlanKey]?.premium && <span className="ml-1 px-1 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">65+ N/A</span>}
                                    </td>
                                    <td className="p-2">{displayPlan.network}</td>
                                    <td className="p-2">
                                      {displayPlan.plan}
                                      {hasAnyEdits && <span className="ml-1 text-blue-500 text-xs">✎</span>}
                                    </td>
                                    <td className="p-2">{displayPlan.copay}</td>
                                    <td className={`p-2 text-right font-semibold ${plan.needsManualRate && displayPlan.premium === 0 ? 'text-amber-600 bg-amber-50' : 'text-blue-700'}`}>
                                      {plan.needsManualRate && displayPlan.premium === 0 ? (
                                        <span className="flex items-center justify-end gap-1">
                                          <span className="text-xs">N/A</span>
                                          <button 
                                            onClick={() => openEditResultPlanModal(member.id, plan.id)} 
                                            className="px-1 py-0.5 text-xs bg-amber-200 hover:bg-amber-300 rounded"
                                            title="Click to enter premium manually"
                                          >✏️</button>
                                        </span>
                                      ) : (
                                        `AED ${displayPlan.premium?.toLocaleString()}`
                                      )}
                                    </td>
                                    <td className="p-2 text-center">
                                      <select value={plan.status} onChange={(e) => updatePlanStatus(member.id, plan.id, e.target.value)} className="text-xs px-2 py-1 border rounded">
                                        <option value="none">-</option>
                                        <option value="renewal">Renewal</option>
                                        <option value="alternative">Alternative</option>
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