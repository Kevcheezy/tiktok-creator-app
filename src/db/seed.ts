import 'dotenv/config';
import { db } from './index';
import { aiCharacter, scriptTemplate } from './schema';

async function seed() {
  console.log('Seeding database...');

  // ─── AI Characters ───────────────────────────────────────────────────────

  const characters = [
    {
      name: 'Dr. Eve',
      avatarPersona: 'pharmacist',
      categories: ['supplements', 'skincare'],
      appearance:
        'young woman, late 20s, dark hair in high bun, blue eyes, natural makeup',
      wardrobe:
        'white lab coat over white ribbed tank top, gold coin layered necklaces',
      setting:
        'cozy bedroom with unmade bed, ring light visible, warm natural lighting',
      voiceDescription: 'pharmacist',
    },
    {
      name: 'Dr. Marcus',
      avatarPersona: 'pharmacist',
      categories: ['supplements'],
      appearance:
        'Authoritative 50yo pharmacist, salt-and-pepper hair, clean-shaven, warm brown eyes, professional glasses',
      wardrobe:
        'white lab coat over light blue button-up shirt, pharmacy badge visible',
      setting:
        'pharmacy shelves with medicine bottles background, professional lighting',
      voiceDescription: 'pharmacist',
    },
    {
      name: 'Dr. Sophia Chen',
      avatarPersona: 'dermatologist',
      categories: ['skincare'],
      appearance:
        'Expert 40yo dermatologist, Asian-American, sleek black hair in low ponytail, minimal elegant makeup',
      wardrobe:
        'white medical coat, stethoscope around neck, pearl stud earrings',
      setting:
        'modern clinical office, skincare products on shelves',
      voiceDescription: 'dermatologist',
    },
    {
      name: 'Coach Mia',
      avatarPersona: 'fitness_coach',
      categories: ['fitness'],
      appearance:
        'Fit 35yo personal trainer, athletic build, blonde hair in high ponytail, tanned skin, bright smile',
      wardrobe:
        'fitted athletic tank top, fitness watch, wireless earbuds around neck',
      setting:
        'modern gym background, weights visible, energetic atmosphere',
      voiceDescription: 'fitness_coach',
    },
    {
      name: 'Tech Tyler',
      avatarPersona: 'tech_reviewer',
      categories: ['tech'],
      appearance:
        'Knowledgeable 30yo tech reviewer, trendy haircut, light stubble, glasses with blue light filter',
      wardrobe:
        'casual professional - premium hoodie or button-up, Apple Watch, minimalist style',
      setting:
        'modern studio with tech equipment, LED backlighting, clean desk setup',
      voiceDescription: 'tech_reviewer',
    },
    {
      name: 'Chef Antonio',
      avatarPersona: 'chef',
      categories: ['kitchen'],
      appearance:
        'Professional 45yo chef, Mediterranean features, salt-and-pepper beard, warm expression',
      wardrobe:
        "chef's whites, kitchen towel over shoulder, wedding ring visible",
      setting:
        'commercial kitchen background, stainless steel, steam visible, warm lighting',
      voiceDescription: 'chef',
    },
    {
      name: 'Style Sarah',
      avatarPersona: 'stylist',
      categories: ['fashion'],
      appearance:
        'Trendy 35yo fashion stylist, impeccable makeup, styled hair, expressive features',
      wardrobe:
        'current season designer pieces, statement accessories, polished look',
      setting:
        'boutique setting, clothing racks visible, good lighting',
      voiceDescription: 'stylist',
    },
    {
      name: 'Designer Diana',
      avatarPersona: 'interior_designer',
      categories: ['home'],
      appearance:
        'Creative 40yo interior designer, elegant bob haircut, artistic jewelry, warm smile',
      wardrobe:
        'smart casual - tailored blazer, statement necklace, sophisticated style',
      setting:
        'well-decorated space, plants visible, curated home accessories',
      voiceDescription: 'interior_designer',
    },
    {
      name: 'Nurse Nina',
      avatarPersona: 'pediatric_nurse',
      categories: ['baby'],
      appearance:
        'Caring 40yo pediatric nurse, gentle features, kind eyes, reassuring smile',
      wardrobe:
        'scrubs in soft colors, name badge, practical yet caring appearance',
      setting:
        'nursery setting, soft colors, baby items visible',
      voiceDescription: 'pediatric_nurse',
    },
    {
      name: 'Dr. James',
      avatarPersona: 'veterinarian',
      categories: ['pet'],
      appearance:
        'Friendly 45yo veterinarian, warm features, slight gray at temples, genuine smile',
      wardrobe:
        'white coat, stethoscope, pet-friendly demeanor',
      setting:
        'clinic setting, pet photos on wall',
      voiceDescription: 'veterinarian',
    },
    {
      name: 'Advisor Michael',
      avatarPersona: 'financial_advisor',
      categories: ['finance'],
      appearance:
        'Professional 50yo financial advisor, distinguished appearance, confident posture',
      wardrobe:
        'business suit, quality watch, subtle accessories',
      setting:
        'modern office, city view or bookshelf',
      voiceDescription: 'financial_advisor',
    },
  ];

  const insertedCharacters = await db
    .insert(aiCharacter)
    .values(characters)
    .onConflictDoNothing()
    .returning();

  console.log(`Inserted ${insertedCharacters.length} AI characters`);

  // ─── Script Templates ────────────────────────────────────────────────────

  const templates = [
    {
      name: 'Challenge Common Belief - Diet',
      hookType: 'challenge_belief',
      hookScore: 12,
      categories: ['supplements', 'fitness'],
      textHookTemplate:
        'Lean at {age} and I eat {forbidden_food} every day...',
      spokenHookTemplate:
        'Everyone told me I had to cut out {forbidden_food} to get lean. They were wrong, and here\'s why...',
      energyArc: { start: 'HIGH', middle: 'HIGH', end: 'HIGH' },
    },
    {
      name: 'This Should NOT Work',
      hookType: 'challenge_belief',
      hookScore: 11,
      categories: ['supplements', 'skincare', 'kitchen', 'tech'],
      textHookTemplate:
        'This {product_type} should NOT {unexpected_benefit}...',
      spokenHookTemplate:
        "Okay so this is weird, but this {product_type} actually {unexpected_benefit} and I'm kind of obsessed...",
      energyArc: { start: 'HIGH', middle: 'PEAK', end: 'HIGH' },
    },
    {
      name: 'POV Success Shot',
      hookType: 'curiosity_gap',
      hookScore: 10,
      categories: ['fitness', 'skincare', 'finance'],
      textHookTemplate:
        'POV: The {result} that got {impressive_metric}...',
      spokenHookTemplate:
        'So this is the exact {method/product} I used to {achieve result}, and nobody talks about this...',
      energyArc: { start: 'HIGH', middle: 'HIGH', end: 'MEDIUM' },
    },
    {
      name: 'Industry Secret Exposed',
      hookType: 'curiosity_gap',
      hookScore: 13,
      categories: ['supplements', 'skincare', 'finance', 'tech'],
      textHookTemplate:
        "{Industry} companies don't want you to know this...",
      spokenHookTemplate:
        "As a {professional_title}, I probably shouldn't be telling you this, but {industry} companies have been hiding something...",
      energyArc: { start: 'PEAK', middle: 'HIGH', end: 'HIGH' },
    },
    {
      name: 'Before/After Transformation',
      hookType: 'contrast',
      hookScore: 11,
      categories: ['skincare', 'fitness', 'home'],
      textHookTemplate:
        'My {thing} {time_period} ago vs now...',
      spokenHookTemplate:
        "I cannot believe I'm showing you this, but look at my {thing} {time_period} ago compared to now...",
      energyArc: { start: 'MEDIUM', middle: 'HIGH', end: 'PEAK' },
    },
    {
      name: 'Stop Scrolling Direct',
      hookType: 'planted_question',
      hookScore: 10,
      categories: ['supplements', 'skincare', 'fitness', 'baby', 'pet'],
      textHookTemplate:
        'STOP if you struggle with {common_problem}...',
      spokenHookTemplate:
        "Okay stop scrolling if you deal with {common_problem}, because I'm about to change your life...",
      energyArc: { start: 'PEAK', middle: 'HIGH', end: 'HIGH' },
    },
    {
      name: 'Controversial Opinion',
      hookType: 'challenge_belief',
      hookScore: 12,
      categories: ['supplements', 'skincare', 'fitness', 'tech', 'finance'],
      textHookTemplate:
        'Unpopular opinion: {controversial_stance}...',
      spokenHookTemplate:
        "This is going to be controversial, but I don't care anymore. {Controversial_stance} and here's the proof...",
      energyArc: { start: 'HIGH', middle: 'PEAK', end: 'HIGH' },
    },
    {
      name: 'Price Reveal Shock',
      hookType: 'curiosity_gap',
      hookScore: 10,
      categories: ['fashion', 'home', 'tech', 'kitchen'],
      textHookTemplate:
        "I can't believe this was only ${price}...",
      spokenHookTemplate:
        "Okay so I found this {product} and when I tell you the price, you're not going to believe me...",
      energyArc: { start: 'HIGH', middle: 'HIGH', end: 'PEAK' },
    },
    {
      name: 'Expert Endorsement',
      hookType: 'challenge_belief',
      hookScore: 12,
      categories: ['supplements', 'skincare', 'baby', 'pet'],
      textHookTemplate:
        'As a {professional_title}, I never recommend {category}. Except this one...',
      spokenHookTemplate:
        'As a {professional_title} for {years} years, I almost never recommend {category} products to my clients. But this one is different...',
      energyArc: { start: 'MEDIUM', middle: 'HIGH', end: 'HIGH' },
    },
    {
      name: 'Time Saver Discovery',
      hookType: 'planted_question',
      hookScore: 11,
      categories: ['kitchen', 'home', 'tech', 'fitness'],
      textHookTemplate:
        'Why did nobody tell me about this sooner...',
      spokenHookTemplate:
        "I'm actually mad that nobody told me about this sooner. This {product} just saved me {time/money}...",
      energyArc: { start: 'HIGH', middle: 'HIGH', end: 'PEAK' },
    },
  ];

  const insertedTemplates = await db
    .insert(scriptTemplate)
    .values(templates)
    .onConflictDoNothing()
    .returning();

  console.log(`Inserted ${insertedTemplates.length} script templates`);

  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
