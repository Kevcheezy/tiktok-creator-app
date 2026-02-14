// Avatar mapping: product category -> authority figure description
export const AVATAR_MAPPING: Record<string, { title: string; appearance: string; wardrobe: string; setting: string }> = {
  supplements: {
    title: 'Pharmacist',
    appearance: 'Professional pharmacist, white coat, pharmacy shelves background',
    wardrobe: 'white lab coat over professional attire',
    setting: 'pharmacy shelves with medicine bottles background, professional lighting',
  },
  skincare: {
    title: 'Dermatologist',
    appearance: 'Expert dermatologist, clinical office, professional attire',
    wardrobe: 'white medical coat, stethoscope around neck',
    setting: 'modern clinical office, skincare products on shelves, soft professional lighting',
  },
  fitness: {
    title: 'Personal Trainer',
    appearance: 'Fit personal trainer, gym setting, athletic wear',
    wardrobe: 'fitted athletic tank top, fitness watch',
    setting: 'modern gym background, weights visible, energetic atmosphere, good lighting',
  },
  tech: {
    title: 'Tech Reviewer',
    appearance: 'Tech reviewer, modern studio, casual professional',
    wardrobe: 'casual professional - premium hoodie or button-up, minimalist style',
    setting: 'modern studio with tech equipment, LED backlighting, clean desk setup',
  },
  kitchen: {
    title: 'Chef',
    appearance: 'Professional chef, commercial kitchen, chef\'s whites',
    wardrobe: 'chef\'s whites, kitchen towel over shoulder',
    setting: 'commercial kitchen background, stainless steel, steam visible, warm lighting',
  },
  fashion: {
    title: 'Fashion Stylist',
    appearance: 'Fashion stylist, boutique setting, trendy outfit',
    wardrobe: 'current season designer pieces, statement accessories, polished look',
    setting: 'boutique setting, clothing racks visible, good lighting, stylish decor',
  },
  home: {
    title: 'Interior Designer',
    appearance: 'Interior designer, well-decorated space',
    wardrobe: 'smart casual - tailored blazer, statement necklace, sophisticated style',
    setting: 'well-decorated space, plants visible, curated home accessories, natural light',
  },
  baby: {
    title: 'Pediatric Nurse',
    appearance: 'Pediatric nurse, nursery setting, scrubs',
    wardrobe: 'scrubs in soft colors, name badge, practical yet caring appearance',
    setting: 'nursery setting, soft colors, baby items visible, warm lighting',
  },
  pet: {
    title: 'Veterinarian',
    appearance: 'Veterinarian, clinic setting, white coat',
    wardrobe: 'white coat, stethoscope, pet-friendly demeanor',
    setting: 'clinic setting, pet photos on wall, clean environment',
  },
  finance: {
    title: 'Financial Advisor',
    appearance: 'Financial advisor, office setting, business suit',
    wardrobe: 'business suit, quality watch, subtle accessories',
    setting: 'modern office, city view or bookshelf, professional atmosphere',
  },
};

// Voice mapping: persona -> voice description for ElevenLabs Voice Design
export const VOICE_MAPPING: Record<string, { gender: string; description: string }> = {
  pharmacist: { gender: 'male', description: 'Deep, calm, professional, trustworthy, authoritative' },
  dermatologist: { gender: 'female', description: 'Warm, professional, caring, confident. Clear enunciation with a soothing tone' },
  fitness_coach: { gender: 'female', description: 'High energy, motivational, intense, assertive. Fast-paced and punchy' },
  tech_reviewer: { gender: 'male', description: 'Crisp, articulate, fast-paced, geeky but cool. Clear enunciation' },
  chef: { gender: 'male', description: 'Deep, gravelly, warm, passionate. Italian-American accent is subtle but present' },
  stylist: { gender: 'female', description: 'Trendy, confident, enthusiastic. Upbeat and engaging' },
  interior_designer: { gender: 'female', description: 'Creative, warm, articulate. Sophisticated but approachable' },
  pediatric_nurse: { gender: 'female', description: 'Caring, nurturing, gentle. Reassuring and trustworthy' },
  veterinarian: { gender: 'male', description: 'Friendly, compassionate, knowledgeable. Warm and reassuring' },
  financial_advisor: { gender: 'male', description: 'Professional, trustworthy, confident. Clear and authoritative' },
};

// Fallback voices if Voice Design fails
export const FALLBACK_VOICES = {
  male: { name: 'Adam', voiceId: 'pNInz6obpgDQGcFmaJgB' },
  female: { name: 'Rachel', voiceId: 'EXAVITQu4vr4xnSDxMaL' },
} as const;

// Pipeline configuration
export const PIPELINE_CONFIG = {
  segmentCount: 4,
  segmentDuration: 15,
  shotsPerSegment: 3,
  shotDuration: 5,
  totalDuration: 60,
  syllablesPerSegment: { min: 82, max: 90, warnMin: 75, warnMax: 95, errorMin: 60, errorMax: 110 },
  hookScoreMinimum: 10,
  hookScoreMax: 14,
} as const;

// Product placement arc across 4 segments
export const PRODUCT_PLACEMENT_ARC = [
  { segment: 1, section: 'Hook', visibility: 'none', description: 'No product visible — pure attention grab' },
  { segment: 2, section: 'Problem', visibility: 'subtle', description: 'Product on table in background' },
  { segment: 3, section: 'Solution + Product', visibility: 'hero', description: 'Hand gestures toward product, picks up, shows label' },
  { segment: 4, section: 'CTA', visibility: 'set_down', description: 'Product set down but still in frame' },
] as const;

// Energy arc per segment
export const ENERGY_ARC = [
  { segment: 1, section: 'Hook', pattern: { start: 'HIGH', middle: 'HIGH', end: 'HIGH' }, description: 'Sustained high energy (exception)' },
  { segment: 2, section: 'Problem', pattern: { start: 'LOW', middle: 'PEAK', end: 'LOW' }, description: 'Calm -> builds -> settles' },
  { segment: 3, section: 'Solution + Product', pattern: { start: 'LOW', middle: 'PEAK', end: 'LOW' }, description: 'Calm -> peaks on stats -> settles' },
  { segment: 4, section: 'CTA', pattern: { start: 'LOW', middle: 'PEAK', end: 'LOW' }, description: 'Casual -> peaks on value -> confident close' },
] as const;

// Project status lifecycle
export const PROJECT_STATUSES = [
  'created',
  'analyzing',
  'scripting',
  'casting',
  'directing',
  'editing',
  'completed',
  'failed',
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

// Product categories
export const PRODUCT_CATEGORIES = [
  'supplements',
  'skincare',
  'fitness',
  'tech',
  'kitchen',
  'fashion',
  'home',
  'baby',
  'pet',
  'finance',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

// Creatomate template ID for final video rendering
export const CREATOMATE_TEMPLATE_ID = '85021700-850c-49cf-a65f-06aa50e720e6';

// Cost per API call (from cost_config.json)
export const API_COSTS = {
  wavespeedChat: 0.01,
  nanoBananaPro: 0.02,
  klingVideo: 1.20,
  elevenLabsTts: 0.05,
} as const;
