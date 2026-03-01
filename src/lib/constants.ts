// ─── Video Model Config Type ────────────────────────────────────────────────

/**
 * VideoModelConfig — the shape of a video_model row from the database.
 * All agents read pipeline params from this config instead of hardcoded constants.
 */
export interface VideoModelConfig {
  id: string;
  slug: string;
  name: string;
  provider: string;
  api_endpoint: string;
  segment_count: number;
  segment_duration: number;
  shots_per_segment: number;
  shot_duration: number;
  total_duration: number;
  resolution: string;
  aspect_ratio: string;
  supports_tail_image: boolean;
  supports_multi_prompt: boolean;
  cost_per_segment: number;
  syllables_per_segment: { min: number; max: number; warnMin: number; warnMax: number; errorMin: number; errorMax: number };
  energy_arc: Array<{ segment: number; section: string; pattern: { start: string; middle: string; end: string }; description: string }>;
  product_placement_arc: Array<{ segment: number; section: string; visibility: string; description: string }>;
  section_names: string[];
  frame_actions: Array<{ segment: number; start: string; end: string }>;
  is_default: boolean;
  status: string;
}

/**
 * Build a VideoModelConfig from PIPELINE_CONFIG + hardcoded constants.
 * Used as fallback when a project has no video_model_id.
 */
export function getFallbackVideoModel(): VideoModelConfig {
  return {
    id: 'fallback',
    slug: 'kling-3.0-pro',
    name: 'Kling 3.0 Pro (fallback)',
    provider: 'wavespeed',
    api_endpoint: '/api/v3/kwaivgi/kling-v3.0-pro/image-to-video',
    segment_count: PIPELINE_CONFIG.segmentCount,
    segment_duration: PIPELINE_CONFIG.segmentDuration,
    shots_per_segment: PIPELINE_CONFIG.shotsPerSegment,
    shot_duration: PIPELINE_CONFIG.shotDuration,
    total_duration: PIPELINE_CONFIG.totalDuration,
    resolution: '1080p',
    aspect_ratio: '9:16',
    supports_tail_image: true,
    supports_multi_prompt: true,
    cost_per_segment: API_COSTS.klingVideo,
    syllables_per_segment: { ...PIPELINE_CONFIG.syllablesPerSegment },
    energy_arc: ENERGY_ARC.map(e => ({ ...e, pattern: { ...e.pattern } })),
    product_placement_arc: PRODUCT_PLACEMENT_ARC.map(p => ({ ...p })),
    section_names: ['Hook', 'Problem', 'Solution + Product', 'CTA'],
    frame_actions: FRAME_ACTIONS.map(f => ({ ...f })),
    is_default: true,
    status: 'active',
  };
}

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

// Fallback voices if Voice Design fails
export const FALLBACK_VOICES = {
  male: { name: 'Adam', voiceId: 'pNInz6obpgDQGcFmaJgB' },
  female: { name: 'Rachel', voiceId: 'EXAVITQu4vr4xnSDxMaL' },
} as const;

// Output resolution (1080p vertical for TikTok 9:16)
export const RESOLUTION = {
  width: 1080,
  height: 1920,
  aspectRatio: '9:16',
  label: '1080p',
} as const;

// Pipeline configuration
export const PIPELINE_CONFIG = {
  segmentCount: 4,
  segmentDuration: 10,
  shotsPerSegment: 2,
  shotDuration: 5,
  totalDuration: 40,
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

// Valid product image angles for multi-angle product photography
export const PRODUCT_IMAGE_ANGLES = ['front', 'side', 'back', 'label', 'lifestyle'] as const;
export type ProductImageAngle = typeof PRODUCT_IMAGE_ANGLES[number];

// Maps PRODUCT_PLACEMENT_ARC visibility → preferred product image angles for CastingAgent
export const VISIBILITY_ANGLE_MAP: Record<string, ProductImageAngle[]> = {
  none: [],
  subtle: ['lifestyle', 'side'],
  hero: ['front', 'label'],
  set_down: ['front', 'side'],
};

// Energy arc per segment
export const ENERGY_ARC = [
  { segment: 1, section: 'Hook', pattern: { start: 'HIGH', middle: 'HIGH', end: 'HIGH' }, description: 'Sustained high energy (exception)' },
  { segment: 2, section: 'Problem', pattern: { start: 'LOW', middle: 'PEAK', end: 'LOW' }, description: 'Calm -> builds -> settles' },
  { segment: 3, section: 'Solution + Product', pattern: { start: 'LOW', middle: 'PEAK', end: 'LOW' }, description: 'Calm -> peaks on stats -> settles' },
  { segment: 4, section: 'CTA', pattern: { start: 'LOW', middle: 'PEAK', end: 'LOW' }, description: 'Casual -> peaks on value -> confident close' },
] as const;

// Per-segment pose/action cues to differentiate START vs END keyframes.
// Without these, segments where start/end energy are both "LOW" produce identical frames.
export const FRAME_ACTIONS = [
  { segment: 0, start: 'eyes wide, leaning toward camera, mouth slightly open mid-speech, one hand raised', end: 'head tilted, confident smirk, gesturing with opposite hand, slight lean back' },
  { segment: 1, start: 'sitting relaxed, hands folded or in lap, neutral/curious expression, looking at camera', end: 'leaning forward, slight frown or concerned expression, one hand raised palm-up as if asking a question' },
  { segment: 2, start: 'reaching toward the product on the table, beginning to pick it up, eager expression', end: 'holding product up toward camera showing label clearly, enthusiastic smile, slight head tilt' },
  { segment: 3, start: 'product held at chest level, speaking earnestly to camera, open body language', end: 'setting product down on table, pointing at camera with confidence, warm smile, slight nod' },
] as const;

// Segment tagging enums (R1.5.10)
export const INTERACTION_TYPES = [
  'hold_and_show', 'apply_to_skin', 'stir_mix', 'demonstrate',
  'pour_drink', 'unbox', 'compare', 'try_on', 'set_down_point', 'none',
] as const;
export type InteractionType = typeof INTERACTION_TYPES[number];

export const CAMERA_ANGLES = ['close-up', 'medium', 'wide', 'over-shoulder'] as const;
export type CameraAngle = typeof CAMERA_ANGLES[number];

export const CAMERA_MOVEMENTS = ['static', 'slow_zoom_in', 'slow_zoom_out', 'pan_left', 'pan_right', 'tracking'] as const;
export type CameraMovement = typeof CAMERA_MOVEMENTS[number];

export const LIGHTING_DIRECTIONS = ['ring_light_front', 'natural_window', 'warm_ambient', 'dramatic_side', 'soft_diffused'] as const;
export type LightingDirection = typeof LIGHTING_DIRECTIONS[number];

// Project status lifecycle
export const PROJECT_STATUSES = [
  'created',
  'analyzing',
  'analysis_review',
  'scripting',
  'script_review',
  'broll_planning',
  'broll_review',
  'influencer_selection',
  'casting',
  'casting_review',
  'directing',
  'voiceover',
  'broll_generation',
  'asset_review',
  'editing',
  'completed',
  'failed',
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

// Valid status transitions — any transition not in this map is invalid
export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  created: ['analyzing'],
  analyzing: ['analysis_review', 'failed'],
  analysis_review: ['scripting'],
  scripting: ['script_review', 'failed'],
  script_review: ['broll_planning'],
  broll_planning: ['broll_review', 'failed'],
  broll_review: ['influencer_selection'],
  influencer_selection: ['casting'],
  casting: ['casting_review', 'failed'],
  casting_review: ['directing'],
  directing: ['voiceover', 'failed'],
  voiceover: ['broll_generation', 'failed'],
  broll_generation: ['asset_review', 'failed'],
  asset_review: ['editing'],
  editing: ['completed', 'failed'],
  completed: [],
  failed: ['analyzing', 'scripting', 'broll_planning', 'casting', 'directing', 'voiceover', 'broll_generation', 'editing'],
};

// Statuses where the user can edit project settings (tone, character, influencer)
export const REVIEW_GATE_STATUSES: ProjectStatus[] = [
  'analysis_review',
  'script_review',
  'broll_review',
  'influencer_selection',
  'casting_review',
  'asset_review',
];

// Editable project fields and which statuses they're editable at
export const EDITABLE_PROJECT_FIELDS = ['tone', 'character_id', 'influencer_id', 'name'] as const;

// Map of stage to the review gate it should restart from
export const RESTART_STAGE_MAP: Record<string, { targetStatus: ProjectStatus; queueStep: string }> = {
  analysis: { targetStatus: 'created', queueStep: 'product_analysis' },
  scripting: { targetStatus: 'analysis_review', queueStep: 'scripting' },
  broll_planning: { targetStatus: 'script_review', queueStep: 'broll_planning' },
  casting: { targetStatus: 'broll_review', queueStep: 'casting' },
  directing: { targetStatus: 'casting_review', queueStep: 'directing' },
  voiceover: { targetStatus: 'casting_review', queueStep: 'voiceover' },
  broll_generation: { targetStatus: 'asset_review', queueStep: 'broll_generation' },
  editing: { targetStatus: 'asset_review', queueStep: 'editing' },
};

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

// Script tones: psychologically-targeted voice/style presets for viral TikTok UGC
export const SCRIPT_TONES = {
  'reluctant-insider': {
    id: 'reluctant-insider' as const,
    label: 'Reluctant Insider',
    tone: 'Reluctant insider leaking a secret — hesitant but genuinely helpful',
    psychology: 'Creates exclusivity and trust. Viewer feels they\'re getting information they shouldn\'t have.',
    bestFor: 'Luxury dupes, industry secrets, "what they don\'t tell you" angles',
    promptBlock: `TONE: RELUCTANT INSIDER — Hesitant but genuinely helpful, like leaking a secret.

VOICE CHARACTERISTICS:
- Speak as if you're glancing over your shoulder before sharing. Slightly nervous but compelled to help.
- Use hedging phrases: "I probably shouldn't say this but..." / "don't tell anyone I told you this"
- Sentence structure: Whispered confidence. Short, conspiratorial sentences punctuated by reluctant revelations.
- Vocabulary: insider jargon dropped casually, "the real reason," "what they won't tell you," "between us"
- Energy: Quiet urgency. Like passing a note in class.
- Hook style: Reluctant confession opener: "I work in this industry and... okay, I'm just gonna say it."
- CTA style: Protective nudge: "I'm sharing the link but seriously, keep this between us"
- AVOID: Loud enthusiasm, salesy language, generic superlatives, anything that breaks the insider illusion
- EXAMPLES: "so... nobody in the industry talks about this" / "I've been going back and forth on whether to post this" / "you didn't hear this from me"`,
  },
  'big-sis': {
    id: 'big-sis' as const,
    label: 'Big Sis',
    tone: 'Older sister saving you from a mistake — protective but not preachy',
    psychology: 'Triggers loss aversion. Viewer fears missing out on wisdom that could save them pain.',
    bestFor: 'Skincare, supplements, financial products, anything with common buyer regrets',
    promptBlock: `TONE: BIG SIS — Protective older sister energy, saving you from a mistake.

VOICE CHARACTERISTICS:
- Speak like you've been through it and genuinely want to spare someone the same pain.
- Use caring directional language: "okay listen," "trust me on this," "I wish someone told me"
- Sentence structure: Direct, warm commands followed by experience-backed reasoning. Conversational but firm.
- Vocabulary: "before you waste your money on," "I made this mistake so you don't have to," "real talk"
- Energy: Warm authority. Not angry, not preachy — just deeply been-there-done-that.
- Hook style: Protective warning: "Stop. Before you buy another one of those, hear me out."
- CTA style: Caring push: "Do yourself a favor and just try it. Future you will thank you."
- AVOID: Condescension, lecturing tone, making the viewer feel dumb, being preachy or superior
- EXAMPLES: "okay I need to save you from the mistake I made" / "if I could go back and tell myself one thing..." / "please just trust me on this"`,
  },
  'converted-skeptic': {
    id: 'converted-skeptic' as const,
    label: 'Converted Skeptic',
    tone: 'Skeptic who got converted — surprised and slightly annoyed it actually works',
    psychology: 'Overcomes objections preemptively. If a skeptic believes it, it must be real.',
    bestFor: 'Products with bold claims, anything "too good to be true," wellness trends',
    promptBlock: `TONE: CONVERTED SKEPTIC — Surprised and slightly annoyed that this actually works.

VOICE CHARACTERISTICS:
- Start with genuine doubt/dismissal, transition through surprise to reluctant endorsement.
- Use self-correction mid-thought: "I thought this was..." / "okay wait, hold on" / "I take it back"
- Sentence structure: Fragmented. Self-interrupting. Show the mental shift happening in real time.
- Vocabulary doubt phase: "overpriced," "gimmick," "no way," "yeah right," "I literally rolled my eyes"
- Vocabulary belief phase: "I was wrong," "okay fine," "I owe this an apology," "I'm annoyed it works"
- Energy: Cynical → surprised → reluctantly impressed. Arc is the whole point.
- Hook style: Contrarian opening: "I bought this to prove it doesn't work. I was SO wrong."
- CTA style: Grudging endorsement: "I can't believe I'm saying this, but... yeah, get it."
- AVOID: Fake doubt, switching too fast, praising without specifics, losing the skeptic voice after conversion
- EXAMPLES: "I literally rolled my eyes at the ad" / "okay WAIT. Hold on." / "fine. FINE. It works. Are you happy?"`,
  },
  'tired-expert': {
    id: 'tired-expert' as const,
    label: 'Tired Expert',
    tone: 'Exhausted expert who\'s done the research so you don\'t have to — efficient and direct',
    psychology: 'Transfers authority while respecting viewer\'s time. Implies massive effort behind simple recommendation.',
    bestFor: 'Complex categories (supplements, tech, finance), comparison content',
    promptBlock: `TONE: TIRED EXPERT — Done the research so you don't have to. Efficient and direct.

VOICE CHARACTERISTICS:
- Speak like someone who's tested 47 versions and can finally give a straight answer.
- Use efficiency markers: "I'll save you the research," "bottom line," "here's what actually matters"
- Sentence structure: Short, declarative, no fluff. Get to the point. Earned authority, not performed.
- Vocabulary: Specific numbers, comparisons, ingredient names, technical terms explained plainly
- Energy: Calm exhaustion that reads as credibility. Low-key "I've seen it all" energy.
- Hook style: Time-saving authority: "I tested 30 of these so you don't have to. Here's the one."
- CTA style: Efficient recommendation: "Save yourself the trouble. This is the one."
- AVOID: Excitement, hype, vague claims, explaining things viewers didn't ask about, over-qualifying
- EXAMPLES: "after testing literally every option on the market..." / "I'll keep this short" / "the data speaks for itself"`,
  },
  'obsessed-nerd': {
    id: 'obsessed-nerd' as const,
    label: 'Obsessed Nerd',
    tone: 'Obsessed nerd who can\'t stop talking about this one thing — passionate but self-aware',
    psychology: 'Authenticity through enthusiasm. Passion is contagious and hard to fake.',
    bestFor: 'Niche products, hobbyist gear, anything with a learning curve',
    promptBlock: `TONE: OBSESSED NERD — Can't stop talking about this. Passionate but self-aware about it.

VOICE CHARACTERISTICS:
- Speak like someone who has been WAITING for someone to ask about this topic. Pure uncontainable enthusiasm.
- Self-aware about being too much: "okay I know I'm being a lot right now but..." / "bear with me"
- Sentence structure: Run-on enthusiasm. Tangents that prove depth. Speed up on the exciting parts.
- Vocabulary: Deep-cut details that only someone obsessed would know. Specific specs, comparisons, history.
- Energy: Starts excited, builds to breathless. Self-interrupts with "oh and another thing—"
- Hook style: Burst of enthusiasm: "OKAY so I've been dying to talk about this"
- CTA style: Evangelical sharing: "I literally cannot keep this to myself anymore, you NEED to try this"
- AVOID: Playing it cool, being vague, surface-level claims, hiding the obsession, sounding corporate
- EXAMPLES: "okay so you know how I'm insane about this stuff—" / "I've been testing this for three weeks and I have THOUGHTS" / "sorry in advance, I'm about to go off"`,
  },
  'calm-pro': {
    id: 'calm-pro' as const,
    label: 'Calm Pro',
    tone: 'Calm professional who just states facts — unbothered and confident',
    psychology: 'Low-pressure authority. No desperation signals, implies product sells itself.',
    bestFor: 'Premium products, medical/health, B2B, anything requiring trust',
    promptBlock: `TONE: CALM PRO — Just states facts. Unbothered and confident. Product sells itself.

VOICE CHARACTERISTICS:
- Speak with quiet confidence. No selling, no convincing — just informing.
- Use measured, precise language: "here's what it does," "the formulation includes," "results show"
- Sentence structure: Clean. Medium-length. No filler words. Every sentence earns its place.
- Vocabulary: Clinical precision without being cold. Facts, not feelings. Numbers, not superlatives.
- Energy: Steady and unhurried. The confidence of someone who doesn't need your approval.
- Hook style: Understated authority: "Let me walk you through what makes this different."
- CTA style: No-pressure close: "If you've been looking for something that actually works, this is it."
- AVOID: Excitement, urgency, scarcity tactics, begging, excessive enthusiasm, filler, "honestly"
- EXAMPLES: "here are the facts" / "I'll let the results speak for themselves" / "no hype, just what I found"`,
  },
  'frustrated-solver': {
    id: 'frustrated-solver' as const,
    label: 'Frustrated Solver',
    tone: 'Frustrated problem-solver who finally found the answer — relieved and evangelical',
    psychology: 'Mirrors viewer\'s pain point journey. Resolution feels earned and shareable.',
    bestFor: 'Pain-point products, solutions to common frustrations, lifestyle fixes',
    promptBlock: `TONE: FRUSTRATED SOLVER — Finally found the answer after too long searching. Relieved and evangelical.

VOICE CHARACTERISTICS:
- Start from the frustration. Show the journey. Make the relief feel EARNED.
- Use escalation language: "I tried everything," "nothing worked," "I was about to give up"
- Sentence structure: Problem phase = short, frustrated bursts. Solution phase = longer, relieved flow.
- Vocabulary: Specific failed alternatives mentioned by name. Then the contrast: "and then I found this"
- Energy: Frustrated → desperate → surprised → evangelical relief. Clear emotional arc.
- Hook style: Shared frustration: "If you're as tired of [problem] as I was, keep watching."
- CTA style: Pay-it-forward relief: "I spent months figuring this out so you don't have to. You're welcome."
- AVOID: Starting with the product, skipping the frustration phase, making it sound easy from the start
- EXAMPLES: "I swear I tried EVERYTHING" / "and then... I found this" / "where has this been my whole life"`,
  },
  'playful-challenger': {
    id: 'playful-challenger' as const,
    label: 'Playful Challenger',
    tone: 'Playful challenger calling out your current choice — teasing but not mean',
    psychology: 'Creates cognitive dissonance. Viewer questions their status quo.',
    bestFor: 'Switching products, competitive positioning, "upgrade your life" angles',
    promptBlock: `TONE: PLAYFUL CHALLENGER — Teasing you about your current choice. Fun, not mean.

VOICE CHARACTERISTICS:
- Speak like you're lovingly roasting a friend's bad purchase decisions.
- Use playful provocations: "oh you're still using THAT?" / "bless your heart" / "we need to talk"
- Sentence structure: Quick jabs followed by genuine helpfulness. Teasing setup → real value payoff.
- Vocabulary: Gentle mocking of the old way, enthusiastic reveal of the new way. Contrast is key.
- Energy: Playful confidence. Like knowing a surprise and trying not to spoil it.
- Hook style: Playful callout: "Okay who told you that was good enough? Because they lied."
- CTA style: Friendly dare: "Try it for a week. If you go back to the old one, I'll be shocked."
- AVOID: Being mean, insulting the viewer, condescension, punching down, making people feel bad
- EXAMPLES: "no shade but... okay a little shade" / "your current [product]? We can do better" / "I promise this isn't an attack, it's an intervention"`,
  },
  'quiet-minimalist': {
    id: 'quiet-minimalist' as const,
    label: 'Quiet Minimalist',
    tone: 'Quietly confident minimalist who only recommends one thing — selective and unhurried',
    psychology: 'Scarcity of endorsement implies extreme quality. Less is more.',
    bestFor: 'Hero products, capsule collections, "the only X you need" positioning',
    promptBlock: `TONE: QUIET MINIMALIST — Only recommends one thing. Selective and unhurried.

VOICE CHARACTERISTICS:
- Speak like someone who almost never recommends products, and that restraint IS the recommendation.
- Use scarcity-of-endorsement language: "I rarely say this," "this is the only one I use," "I'm very picky"
- Sentence structure: Sparse. Deliberate. Every word chosen carefully. Silence between thoughts.
- Vocabulary: Intentional, curated, "the only," "I replaced everything with just this," "simplify"
- Energy: Quiet conviction. The opposite of hype. Calm certainty that needs no volume.
- Hook style: Rare endorsement: "I almost never recommend products. This is the exception."
- CTA style: Understated: "If you want to simplify, start here."
- AVOID: Lists, comparisons, overwhelming detail, excitement, urgency, multiple recommendations
- EXAMPLES: "I own exactly one of these" / "this replaced four things in my routine" / "I don't say this lightly"`,
  },
  'truth-teller': {
    id: 'truth-teller' as const,
    label: 'Truth Teller',
    tone: 'Conspiratorial truth-teller exposing an industry lie — righteous but controlled',
    psychology: 'Us vs. them framing. Viewer joins an in-group against a common enemy.',
    bestFor: 'Disruptor brands, clean beauty, transparency plays, anti-establishment positioning',
    promptBlock: `TONE: TRUTH TELLER — Exposing an industry lie. Righteous but controlled.

VOICE CHARACTERISTICS:
- Speak like a whistleblower who's calm enough to be credible but angry enough to be compelling.
- Use expose language: "here's what [industry] doesn't want you to know," "follow the money," "they're banking on you not reading the label"
- Sentence structure: Build the case. Evidence first, then the reveal, then the alternative.
- Vocabulary: Industry terms used against the industry. "Proprietary blend = we won't tell you what's in it"
- Energy: Controlled outrage. Not screaming — just methodically dismantling a lie.
- Hook style: Whistleblower opener: "The [industry] has been lying to you. Let me show you how."
- CTA style: Empowerment: "Now you know. Make your own choice — here's where to start."
- AVOID: Conspiracy theory energy, paranoia, unsubstantiated claims, rage-bait without substance
- EXAMPLES: "let me break down what's actually in this" / "they spend millions so you don't ask this question" / "once you see it, you can't unsee it"`,
  },
} as const;

export type ScriptTone = keyof typeof SCRIPT_TONES;
export const DEFAULT_TONE: ScriptTone = 'reluctant-insider';
export const TONE_IDS = Object.keys(SCRIPT_TONES) as ScriptTone[];

// Creatomate template ID for final video rendering
export const CREATOMATE_TEMPLATE_ID = '85021700-850c-49cf-a65f-06aa50e720e6';

/** Maximum poll time for video generation (Kling 3.0 Pro takes 8-13 min) */
export const VIDEO_POLL_MAX_WAIT = 900000; // 15 minutes

// Cost per API call (from cost_config.json)
export const API_COSTS = {
  wavespeedChat: 0.01,
  nanoBananaPro: 0.07,
  nanoBananaProEdit: 0.07,
  klingVideo: 1.80,  // 1.5x multiplier with sound enabled
  elevenLabsTts: 0.05,
  creatomateRender: 0.50,
  geminiVideoAnalysis: 0.02,
  brollPlanning: 0.01, // 1 LLM call for B-roll shot list
  imageUpscaler: 0.01, // WaveSpeed image upscaler to 4K
  productBgRemoval: 0.07, // WaveSpeed edit used for product background removal
} as const;

// ─── B-Roll Presets ─────────────────────────────────────────────────────────

/**
 * Calculate B-roll shot count per segment based on syllable density.
 * Target: 1 insert every ~20 syllables (~3.5s of speech). Min 2, max 6.
 */
export function calculateBrollCount(syllableCount: number): number {
  return Math.min(6, Math.max(2, Math.ceil(syllableCount / 20)));
}

/** B-roll category preset for a single product category */
export interface BrollCategoryPreset {
  description: string;
  shotTemplate: string;
  details: string[];
  narrativeRole: string;
}

export interface BrollPreset {
  categories: string[];
  presets: Record<string, BrollCategoryPreset>;
}

/** Narrative arc: which B-roll categories map to which script sections */
export const BROLL_NARRATIVE_ARC: Record<string, string[]> = {
  Hook: ['social_proof', 'contrast', 'reaction'],
  Problem: ['research', 'data', 'evidence', 'ingredients'],
  'Solution + Product': ['transformation', 'results', 'before_after', 'action'],
  CTA: ['lifestyle', 'product_hero', 'plating', 'setup'],
};

export const BROLL_PRESETS: Record<string, BrollPreset> = {
  supplements: {
    categories: ['transformation', 'research', 'lifestyle', 'social_proof'],
    presets: {
      transformation: {
        description: 'Before/after comparisons showing subtle, believable improvements',
        shotTemplate: 'Split-screen before/after comparison showing {detail}, natural indoor lighting, neutral background, no makeup or filter differences, photorealistic, 9:16 vertical',
        details: ['face clarity', 'hair thickness', 'nail strength', 'skin tone evenness', 'under-eye brightness', 'hand smoothness'],
        narrativeRole: 'Cumulative visual proof stacked throughout',
      },
      research: {
        description: 'Academic papers and clinical studies on wooden desks',
        shotTemplate: 'Photograph of printed academic paper on wooden desk, visible annotations, {detail}, reading glasses nearby, warm ambient lighting, photorealistic, 9:16 vertical',
        details: ['highlighted paragraphs with yellow marker', 'pen circles around key data', 'sticky tabs on page edges', 'handwritten margin notes'],
        narrativeRole: 'Validates problem/solution claims with scientific authority',
      },
      lifestyle: {
        description: 'Product usage moments with casual home aesthetic',
        shotTemplate: '{detail}, natural ring light, casual home kitchen/bathroom aesthetic, clean countertop, photorealistic, 9:16 vertical',
        details: ['close-up of powder scoop being lifted from container', 'coffee pour with supplement being mixed in', 'hero product shot with morning light'],
        narrativeRole: 'Anchors product in relatable daily routine',
      },
      social_proof: {
        description: 'Negative contrast with cheap alternatives',
        shotTemplate: '{detail}, harsh fluorescent lighting, photorealistic, 9:16 vertical',
        details: ['generic supplement bottles crowded on pharmacy shelf', 'cluttered Amazon listing screenshots'],
        narrativeRole: 'Creates negative contrast to elevate the featured product',
      },
    },
  },
  skincare: {
    categories: ['transformation', 'texture', 'routine', 'ingredients'],
    presets: {
      transformation: {
        description: 'Subtle skin improvement close-ups',
        shotTemplate: 'Close-up of {detail}, soft natural lighting, clean background, photorealistic, 9:16 vertical',
        details: ['clear smooth skin texture', 'dewy hydrated complexion', 'even skin tone', 'reduced pore visibility'],
        narrativeRole: 'Visual proof of product efficacy',
      },
      texture: {
        description: 'Product texture and consistency shots',
        shotTemplate: '{detail}, macro photography, soft bokeh background, photorealistic, 9:16 vertical',
        details: ['cream being squeezed onto fingertip', 'serum droplet on glass surface', 'product swatch on back of hand'],
        narrativeRole: 'Sensory appeal — viewer imagines the texture',
      },
      routine: {
        description: 'Skincare application moments',
        shotTemplate: '{detail}, bathroom mirror, soft warm lighting, photorealistic, 9:16 vertical',
        details: ['applying product to cheek with fingertips', 'gentle patting motion on forehead', 'product bottle on marble countertop'],
        narrativeRole: 'Anchors product in daily self-care ritual',
      },
      ingredients: {
        description: 'Hero ingredient visuals',
        shotTemplate: '{detail}, clean white background, studio lighting, photorealistic, 9:16 vertical',
        details: ['hyaluronic acid molecular structure graphic', 'vitamin C oranges and serum bottle', 'aloe vera plant with extract'],
        narrativeRole: 'Scientific credibility through ingredient visualization',
      },
    },
  },
  fitness: {
    categories: ['transformation', 'action', 'setup', 'results'],
    presets: {
      transformation: {
        description: 'Fitness progress visuals',
        shotTemplate: '{detail}, gym lighting, motivational atmosphere, photorealistic, 9:16 vertical',
        details: ['before/after physique comparison', 'progress photos on phone screen', 'measurement tape showing results'],
        narrativeRole: 'Visual proof of transformation',
      },
      action: {
        description: 'Dynamic workout moments',
        shotTemplate: '{detail}, gym environment, energetic lighting, photorealistic, 9:16 vertical',
        details: ['mid-rep exercise with perfect form', 'sweat on equipment surface', 'hand gripping barbell'],
        narrativeRole: 'Energy and effort visualization',
      },
      setup: {
        description: 'Product prep and usage',
        shotTemplate: '{detail}, kitchen or gym counter, clean aesthetic, photorealistic, 9:16 vertical',
        details: ['protein shake being mixed in blender', 'pre-workout scoop with water bottle', 'supplement laid out next to gym bag'],
        narrativeRole: 'Shows product in fitness context',
      },
      results: {
        description: 'Achievement and data visuals',
        shotTemplate: '{detail}, clean background, motivational feel, photorealistic, 9:16 vertical',
        details: ['fitness app showing PR stats', 'stopwatch displaying time improvement', 'scale showing target weight'],
        narrativeRole: 'Data-backed proof of results',
      },
    },
  },
  tech: {
    categories: ['unboxing', 'comparison', 'setup', 'specs'],
    presets: {
      unboxing: {
        description: 'Premium unboxing experience',
        shotTemplate: '{detail}, clean desk, soft LED backlighting, photorealistic, 9:16 vertical',
        details: ['product box being opened from top', 'lifting device from packaging', 'accessories laid out neatly'],
        narrativeRole: 'Premium experience and build quality',
      },
      comparison: {
        description: 'Side-by-side with competitors',
        shotTemplate: '{detail}, neutral surface, even lighting, photorealistic, 9:16 vertical',
        details: ['two devices side by side', 'screen quality comparison close-up', 'size comparison in hand'],
        narrativeRole: 'Objective comparison validates superiority',
      },
      setup: {
        description: 'Quick setup and first use',
        shotTemplate: '{detail}, modern desk setup, ambient LED lighting, photorealistic, 9:16 vertical',
        details: ['plugging in cable', 'first power on screen', 'app pairing on phone'],
        narrativeRole: 'Shows ease of use',
      },
      specs: {
        description: 'Technical specification highlights',
        shotTemplate: '{detail}, dark background, spotlight on product, photorealistic, 9:16 vertical',
        details: ['close-up of port array', 'chip or processor detail', 'material texture macro shot'],
        narrativeRole: 'Technical credibility through detail',
      },
    },
  },
  kitchen: {
    categories: ['cooking', 'before_after', 'ingredients', 'plating'],
    presets: {
      cooking: {
        description: 'Cooking action shots',
        shotTemplate: '{detail}, kitchen counter, warm cooking lighting, steam visible, photorealistic, 9:16 vertical',
        details: ['sizzling in pan with product', 'stirring ingredients in bowl', 'product being used mid-recipe'],
        narrativeRole: 'Product in action during cooking',
      },
      before_after: {
        description: 'Kitchen transformation',
        shotTemplate: '{detail}, kitchen environment, clear lighting, photorealistic, 9:16 vertical',
        details: ['messy counter vs clean counter', 'raw ingredients vs finished dish', 'old method vs new method'],
        narrativeRole: 'Visual proof of improvement',
      },
      ingredients: {
        description: 'Fresh ingredient displays',
        shotTemplate: '{detail}, wooden cutting board, overhead shot, natural light, photorealistic, 9:16 vertical',
        details: ['fresh vegetables arranged neatly', 'spices in small bowls', 'raw ingredients ready for prep'],
        narrativeRole: 'Freshness and quality association',
      },
      plating: {
        description: 'Beautiful finished dishes',
        shotTemplate: '{detail}, restaurant-quality plating, soft directional light, photorealistic, 9:16 vertical',
        details: ['finished dish with garnish', 'overhead flat lay of complete meal', 'close-up of texture and color'],
        narrativeRole: 'Aspirational result — what you could make',
      },
    },
  },
  fashion: {
    categories: ['styling', 'detail', 'lifestyle', 'comparison'],
    presets: {
      styling: {
        description: 'Outfit styling shots',
        shotTemplate: '{detail}, boutique or bedroom mirror, natural light, photorealistic, 9:16 vertical',
        details: ['full outfit mirror selfie', 'accessory pairing options', 'outfit transition before/after'],
        narrativeRole: 'Shows versatility and style',
      },
      detail: {
        description: 'Fabric and construction details',
        shotTemplate: '{detail}, neutral background, macro photography, photorealistic, 9:16 vertical',
        details: ['fabric texture close-up', 'stitching quality detail', 'hardware or zipper detail'],
        narrativeRole: 'Quality proof through details',
      },
      lifestyle: {
        description: 'Wearing in real life',
        shotTemplate: '{detail}, urban or casual setting, golden hour lighting, photorealistic, 9:16 vertical',
        details: ['walking down street in outfit', 'seated at cafe in outfit', 'casual pose in outfit'],
        narrativeRole: 'Product in aspirational lifestyle context',
      },
      comparison: {
        description: 'Price/quality comparison',
        shotTemplate: '{detail}, side by side on neutral surface, even lighting, photorealistic, 9:16 vertical',
        details: ['designer vs dupe side by side', 'tag showing price comparison', 'quality details compared'],
        narrativeRole: 'Value proposition visualization',
      },
    },
  },
  home: {
    categories: ['transformation', 'detail', 'lifestyle', 'space'],
    presets: {
      transformation: {
        description: 'Room/space before and after',
        shotTemplate: '{detail}, interior photography, natural light, photorealistic, 9:16 vertical',
        details: ['room corner before vs after', 'shelf organization transformation', 'lighting change comparison'],
        narrativeRole: 'Visual proof of home improvement',
      },
      detail: {
        description: 'Product craftsmanship and features',
        shotTemplate: '{detail}, styled vignette, soft lighting, photorealistic, 9:16 vertical',
        details: ['material texture close-up', 'mechanism or feature in use', 'color and finish detail'],
        narrativeRole: 'Quality and design appreciation',
      },
      lifestyle: {
        description: 'Product in lived-in home',
        shotTemplate: '{detail}, cozy home interior, warm ambient lighting, photorealistic, 9:16 vertical',
        details: ['product on coffee table with book and mug', 'product in use during daily routine', 'product as room accent'],
        narrativeRole: 'Aspirational home aesthetic',
      },
      space: {
        description: 'Full room context shots',
        shotTemplate: '{detail}, wide angle interior, natural window light, photorealistic, 9:16 vertical',
        details: ['product in full room context', 'before empty space vs styled space', 'room overview with product as focal point'],
        narrativeRole: 'Shows product impact on full space',
      },
    },
  },
  baby: {
    categories: ['safety', 'usage', 'comparison', 'lifestyle'],
    presets: {
      safety: {
        description: 'Safety feature highlights',
        shotTemplate: '{detail}, nursery setting, soft warm lighting, photorealistic, 9:16 vertical',
        details: ['safety certification close-up', 'locking mechanism demonstration', 'non-toxic material label'],
        narrativeRole: 'Trust through safety verification',
      },
      usage: {
        description: 'Product in use with baby',
        shotTemplate: '{detail}, nursery or living room, warm gentle lighting, photorealistic, 9:16 vertical',
        details: ['product being used comfortably', 'easy one-hand operation', 'quick setup demonstration'],
        narrativeRole: 'Ease of use for busy parents',
      },
      comparison: {
        description: 'Competitor comparison',
        shotTemplate: '{detail}, neutral surface, even lighting, photorealistic, 9:16 vertical',
        details: ['side by side with older version', 'feature comparison layout', 'size and portability comparison'],
        narrativeRole: 'Objective improvement over alternatives',
      },
      lifestyle: {
        description: 'Happy family moments',
        shotTemplate: '{detail}, home setting, warm natural light, photorealistic, 9:16 vertical',
        details: ['peaceful nursery scene', 'parent using product confidently', 'organized baby station'],
        narrativeRole: 'Emotional aspiration — peaceful parenthood',
      },
    },
  },
  pet: {
    categories: ['reaction', 'before_after', 'ingredients', 'lifestyle'],
    presets: {
      reaction: {
        description: 'Pet positive reactions',
        shotTemplate: '{detail}, home environment, natural lighting, photorealistic, 9:16 vertical',
        details: ['excited pet approaching product', 'happy pet using product', 'pet relaxed after using product'],
        narrativeRole: 'Authentic pet approval as social proof',
      },
      before_after: {
        description: 'Pet health improvements',
        shotTemplate: '{detail}, consistent background, even lighting, photorealistic, 9:16 vertical',
        details: ['coat condition improvement', 'energy level comparison', 'dental health before/after'],
        narrativeRole: 'Visible health improvement proof',
      },
      ingredients: {
        description: 'Quality ingredient highlights',
        shotTemplate: '{detail}, clean surface, studio lighting, photorealistic, 9:16 vertical',
        details: ['premium ingredient close-up', 'nutrition label highlight', 'fresh natural ingredients'],
        narrativeRole: 'Quality and safety assurance',
      },
      lifestyle: {
        description: 'Pet and owner together',
        shotTemplate: '{detail}, park or home, golden hour lighting, photorealistic, 9:16 vertical',
        details: ['walk in park with product', 'feeding time with product', 'play session after using product'],
        narrativeRole: 'Happy pet-owner bond aspiration',
      },
    },
  },
  finance: {
    categories: ['data', 'comparison', 'lifestyle', 'results'],
    presets: {
      data: {
        description: 'Financial data and charts',
        shotTemplate: '{detail}, modern desk, screen or paper, professional lighting, photorealistic, 9:16 vertical',
        details: ['growth chart on screen', 'spreadsheet with highlighted gains', 'financial dashboard overview'],
        narrativeRole: 'Data-driven credibility',
      },
      comparison: {
        description: 'Old way vs new way',
        shotTemplate: '{detail}, split composition, clean background, photorealistic, 9:16 vertical',
        details: ['traditional bank vs app interface', 'paper statements vs digital dashboard', 'fee comparison table'],
        narrativeRole: 'Clear advantage over status quo',
      },
      lifestyle: {
        description: 'Financial freedom moments',
        shotTemplate: '{detail}, aspirational setting, warm lighting, photorealistic, 9:16 vertical',
        details: ['relaxed person checking phone', 'coffee shop with laptop showing gains', 'travel scene funded by returns'],
        narrativeRole: 'Aspirational outcome visualization',
      },
      results: {
        description: 'Achievement screenshots',
        shotTemplate: '{detail}, phone or laptop screen, clean background, photorealistic, 9:16 vertical',
        details: ['portfolio growth notification', 'savings milestone reached', 'positive balance statement'],
        narrativeRole: 'Proof of financial results',
      },
    },
  },
};

// ─── Downstream Impact Map ──────────────────────────────────────────────────

/**
 * Pipeline order for determining earliest affected stage.
 * Only includes stages that can be restarted (have RESTART_STAGE_MAP entries).
 */
export const PIPELINE_STAGE_ORDER = [
  'scripting',
  'broll_planning',
  'casting',
  'directing',
  'voiceover',
  'broll_generation',
  'editing',
] as const;

/**
 * Estimated cost per pipeline stage for impact warnings.
 * Based on API_COSTS: images at $0.07 each, videos at $1.20 each, etc.
 */
export const STAGE_COST_ESTIMATES: Record<string, { cost: number; label: string }> = {
  scripting: { cost: 0.01, label: 'Script Generation' },
  broll_planning: { cost: 0.01, label: 'B-Roll Planning' },
  broll_generation: { cost: 0.84, label: 'B-Roll Images (~12)' },
  casting: { cost: 0.56, label: 'Keyframe Casting (8 images)' },
  directing: { cost: 4.80, label: 'Video Directing (4 segments)' },
  voiceover: { cost: 0.20, label: 'Voiceover (4 segments)' },
  editing: { cost: 0.01, label: 'Final Video Rendering' },
};

/**
 * Maps review gate stages to the fields editable at that gate,
 * classified as safe (no regeneration) or destructive (requires pipeline restart).
 */
export const DOWNSTREAM_IMPACT_MAP: Record<string, Record<string, {
  type: 'safe' | 'destructive';
  affectedStages: string[];
  description: string;
}>> = {
  analysis_review: {
    product_image_url: { type: 'safe', affectedStages: [], description: 'Visual reference only' },
    product_data: {
      type: 'destructive',
      affectedStages: ['scripting', 'broll_planning', 'casting', 'directing', 'voiceover', 'editing'],
      description: 'Changes product context used by all downstream agents',
    },
    video_analysis: {
      type: 'destructive',
      affectedStages: ['scripting', 'casting', 'directing', 'editing'],
      description: 'Changes SEAL reference used for script and visual style',
    },
  },
  script_review: {
    script_text: {
      type: 'destructive',
      affectedStages: ['casting', 'directing', 'voiceover', 'editing'],
      description: 'Script text drives keyframe prompts, video, and voiceover audio',
    },
    energy_arc: {
      type: 'destructive',
      affectedStages: ['casting', 'directing', 'editing'],
      description: 'Energy arc shapes keyframe poses and video motion',
    },
    shot_scripts: {
      type: 'destructive',
      affectedStages: ['directing', 'broll_planning', 'editing'],
      description: 'Shot descriptions drive video generation and B-roll timing',
    },
    broll_cues: {
      type: 'destructive',
      affectedStages: ['broll_planning', 'broll_generation', 'editing'],
      description: 'Timing cues drive entire B-roll shot list',
    },
    text_overlay: { type: 'safe', affectedStages: [], description: 'Applied at render time' },
    hook_score: { type: 'safe', affectedStages: [], description: 'Metadata only' },
    audio_sync: { type: 'safe', affectedStages: [], description: 'Metadata only' },
  },
  broll_review: {
    prompt: {
      type: 'destructive',
      affectedStages: ['broll_generation', 'editing'],
      description: 'Prompt drives image generation',
    },
    timing_seconds: {
      type: 'destructive',
      affectedStages: ['broll_generation', 'editing'],
      description: 'Timing affects overlay placement in final video',
    },
    duration_seconds: {
      type: 'destructive',
      affectedStages: ['broll_generation', 'editing'],
      description: 'Duration affects overlay length in final video',
    },
    category: { type: 'safe', affectedStages: [], description: 'Metadata only' },
    narrative_role: { type: 'safe', affectedStages: [], description: 'Metadata only' },
  },
  influencer_selection: {
    influencer_id: {
      type: 'destructive',
      affectedStages: ['casting', 'directing', 'editing'],
      description: 'Reference image drives all keyframe generation',
    },
    product_placement: {
      type: 'destructive',
      affectedStages: ['casting', 'directing', 'editing'],
      description: 'Placement overrides affect keyframe visual prompts',
    },
  },
  casting_review: {
    keyframe: {
      type: 'destructive',
      affectedStages: ['directing', 'editing'],
      description: 'Keyframes are input to video generation',
    },
  },
  asset_review: {
    asset: {
      type: 'destructive',
      affectedStages: ['editing'],
      description: 'Changed assets require re-rendering final video',
    },
    text_overlay: { type: 'safe', affectedStages: [], description: 'Applied at render time' },
  },
};

/**
 * Ken Burns effect presets for B-roll still images.
 * Each preset defines start/end values for x_scale, y_scale, x, y
 * that animate over the shot's duration to create motion.
 */
export type KenBurnsDirection = 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right';

export interface KenBurnsPreset {
  x_scale: { start: string; end: string };
  y_scale: { start: string; end: string };
  x: { start: string; end: string };
  y: { start: string; end: string };
}

export const KEN_BURNS_PRESETS: Record<KenBurnsDirection, KenBurnsPreset> = {
  zoom_in: {
    x_scale: { start: '100%', end: '118%' },
    y_scale: { start: '100%', end: '118%' },
    x: { start: '50%', end: '50%' },
    y: { start: '50%', end: '48%' },
  },
  zoom_out: {
    x_scale: { start: '118%', end: '100%' },
    y_scale: { start: '118%', end: '100%' },
    x: { start: '50%', end: '50%' },
    y: { start: '48%', end: '50%' },
  },
  pan_left: {
    x_scale: { start: '115%', end: '115%' },
    y_scale: { start: '115%', end: '115%' },
    x: { start: '55%', end: '45%' },
    y: { start: '50%', end: '50%' },
  },
  pan_right: {
    x_scale: { start: '115%', end: '115%' },
    y_scale: { start: '115%', end: '115%' },
    x: { start: '45%', end: '55%' },
    y: { start: '50%', end: '50%' },
  },
};

const KEN_BURNS_DIRECTIONS: KenBurnsDirection[] = ['zoom_in', 'zoom_out', 'pan_left', 'pan_right'];

/** Pick a Ken Burns direction for a B-roll shot, cycling through directions to avoid repetition. */
export function pickKenBurnsDirection(shotIndex: number): KenBurnsDirection {
  return KEN_BURNS_DIRECTIONS[shotIndex % KEN_BURNS_DIRECTIONS.length];
}
