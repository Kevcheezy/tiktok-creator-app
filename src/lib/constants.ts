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
  'analysis_review',
  'scripting',
  'script_review',
  'influencer_selection',
  'casting',
  'casting_review',
  'directing',
  'voiceover',
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
  script_review: ['influencer_selection'],
  influencer_selection: ['casting'],
  casting: ['casting_review', 'failed'],
  casting_review: ['directing'],
  directing: ['voiceover', 'failed'],
  voiceover: ['asset_review', 'failed'],
  asset_review: ['editing'],
  editing: ['completed', 'failed'],
  completed: [],
  failed: ['analyzing', 'scripting', 'casting', 'directing', 'voiceover', 'editing'], // retry from failed stage
};

// Statuses where the user can edit project settings (tone, character, influencer)
export const REVIEW_GATE_STATUSES: ProjectStatus[] = [
  'analysis_review',
  'script_review',
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
  casting: { targetStatus: 'script_review', queueStep: 'casting' },
  directing: { targetStatus: 'casting_review', queueStep: 'directing' },
  voiceover: { targetStatus: 'casting_review', queueStep: 'voiceover' },
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

// Cost per API call (from cost_config.json)
export const API_COSTS = {
  wavespeedChat: 0.01,
  nanoBananaPro: 0.07,
  nanoBananaProEdit: 0.07,
  klingVideo: 1.20,
  elevenLabsTts: 0.05,
  creatomateRender: 0.50,
} as const;
