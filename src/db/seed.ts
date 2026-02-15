import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seed() {
  console.log('Seeding database...');

  // ─── AI Characters ───────────────────────────────────────────────────────

  const characters = [
    { name: 'Dr. Eve', avatar_persona: 'pharmacist', categories: ['supplements', 'skincare'], appearance: 'young woman, late 20s, dark hair in high bun, blue eyes, natural makeup', wardrobe: 'white lab coat over white ribbed tank top, gold coin layered necklaces', setting: 'cozy bedroom with unmade bed, ring light visible, warm natural lighting', voice_description: 'pharmacist' },
    { name: 'Dr. Marcus', avatar_persona: 'pharmacist', categories: ['supplements'], appearance: 'Authoritative 50yo pharmacist, salt-and-pepper hair, clean-shaven, warm brown eyes, professional glasses', wardrobe: 'white lab coat over light blue button-up shirt, pharmacy badge visible', setting: 'pharmacy shelves with medicine bottles background, professional lighting', voice_description: 'pharmacist' },
    { name: 'Dr. Sophia Chen', avatar_persona: 'dermatologist', categories: ['skincare'], appearance: 'Expert 40yo dermatologist, Asian-American, sleek black hair in low ponytail, minimal elegant makeup', wardrobe: 'white medical coat, stethoscope around neck, pearl stud earrings', setting: 'modern clinical office, skincare products on shelves', voice_description: 'dermatologist' },
    { name: 'Coach Mia', avatar_persona: 'fitness_coach', categories: ['fitness'], appearance: 'Fit 35yo personal trainer, athletic build, blonde hair in high ponytail, tanned skin, bright smile', wardrobe: 'fitted athletic tank top, fitness watch, wireless earbuds around neck', setting: 'modern gym background, weights visible, energetic atmosphere', voice_description: 'fitness_coach' },
    { name: 'Tech Tyler', avatar_persona: 'tech_reviewer', categories: ['tech'], appearance: 'Knowledgeable 30yo tech reviewer, trendy haircut, light stubble, glasses with blue light filter', wardrobe: 'casual professional - premium hoodie or button-up, Apple Watch, minimalist style', setting: 'modern studio with tech equipment, LED backlighting, clean desk setup', voice_description: 'tech_reviewer' },
    { name: 'Chef Antonio', avatar_persona: 'chef', categories: ['kitchen'], appearance: 'Professional 45yo chef, Mediterranean features, salt-and-pepper beard, warm expression', wardrobe: "chef's whites, kitchen towel over shoulder, wedding ring visible", setting: 'commercial kitchen background, stainless steel, steam visible, warm lighting', voice_description: 'chef' },
    { name: 'Style Sarah', avatar_persona: 'stylist', categories: ['fashion'], appearance: 'Trendy 35yo fashion stylist, impeccable makeup, styled hair, expressive features', wardrobe: 'current season designer pieces, statement accessories, polished look', setting: 'boutique setting, clothing racks visible, good lighting', voice_description: 'stylist' },
    { name: 'Designer Diana', avatar_persona: 'interior_designer', categories: ['home'], appearance: 'Creative 40yo interior designer, elegant bob haircut, artistic jewelry, warm smile', wardrobe: 'smart casual - tailored blazer, statement necklace, sophisticated style', setting: 'well-decorated space, plants visible, curated home accessories', voice_description: 'interior_designer' },
    { name: 'Nurse Nina', avatar_persona: 'pediatric_nurse', categories: ['baby'], appearance: 'Caring 40yo pediatric nurse, gentle features, kind eyes, reassuring smile', wardrobe: 'scrubs in soft colors, name badge, practical yet caring appearance', setting: 'nursery setting, soft colors, baby items visible', voice_description: 'pediatric_nurse' },
    { name: 'Dr. James', avatar_persona: 'veterinarian', categories: ['pet'], appearance: 'Friendly 45yo veterinarian, warm features, slight gray at temples, genuine smile', wardrobe: 'white coat, stethoscope, pet-friendly demeanor', setting: 'clinic setting, pet photos on wall', voice_description: 'veterinarian' },
    { name: 'Advisor Michael', avatar_persona: 'financial_advisor', categories: ['finance'], appearance: 'Professional 50yo financial advisor, distinguished appearance, confident posture', wardrobe: 'business suit, quality watch, subtle accessories', setting: 'modern office, city view or bookshelf', voice_description: 'financial_advisor' },
  ];

  const { data: insertedChars, error: charError } = await supabase
    .from('ai_character')
    .upsert(characters, { onConflict: 'name' })
    .select();

  if (charError) {
    console.error('Error seeding characters:', charError);
  } else {
    console.log(`Upserted ${insertedChars?.length || 0} AI characters`);
  }

  // ─── Script Templates ────────────────────────────────────────────────────

  const templates = [
    { name: 'Challenge Common Belief - Diet', hook_type: 'challenge_belief', hook_score: 12, categories: ['supplements', 'fitness'], text_hook_template: 'Lean at {age} and I eat {forbidden_food} every day...', spoken_hook_template: "Everyone told me I had to cut out {forbidden_food} to get lean. They were wrong, and here's why...", energy_arc: { start: 'HIGH', middle: 'HIGH', end: 'HIGH' } },
    { name: 'This Should NOT Work', hook_type: 'challenge_belief', hook_score: 11, categories: ['supplements', 'skincare', 'kitchen', 'tech'], text_hook_template: 'This {product_type} should NOT {unexpected_benefit}...', spoken_hook_template: "Okay so this is weird, but this {product_type} actually {unexpected_benefit} and I'm kind of obsessed...", energy_arc: { start: 'HIGH', middle: 'PEAK', end: 'HIGH' } },
    { name: 'POV Success Shot', hook_type: 'curiosity_gap', hook_score: 10, categories: ['fitness', 'skincare', 'finance'], text_hook_template: 'POV: The {result} that got {impressive_metric}...', spoken_hook_template: 'So this is the exact {method/product} I used to {achieve result}, and nobody talks about this...', energy_arc: { start: 'HIGH', middle: 'HIGH', end: 'MEDIUM' } },
    { name: 'Industry Secret Exposed', hook_type: 'curiosity_gap', hook_score: 13, categories: ['supplements', 'skincare', 'finance', 'tech'], text_hook_template: "{Industry} companies don't want you to know this...", spoken_hook_template: "As a {professional_title}, I probably shouldn't be telling you this, but {industry} companies have been hiding something...", energy_arc: { start: 'PEAK', middle: 'HIGH', end: 'HIGH' } },
    { name: 'Before/After Transformation', hook_type: 'contrast', hook_score: 11, categories: ['skincare', 'fitness', 'home'], text_hook_template: 'My {thing} {time_period} ago vs now...', spoken_hook_template: "I cannot believe I'm showing you this, but look at my {thing} {time_period} ago compared to now...", energy_arc: { start: 'MEDIUM', middle: 'HIGH', end: 'PEAK' } },
    { name: 'Stop Scrolling Direct', hook_type: 'planted_question', hook_score: 10, categories: ['supplements', 'skincare', 'fitness', 'baby', 'pet'], text_hook_template: 'STOP if you struggle with {common_problem}...', spoken_hook_template: "Okay stop scrolling if you deal with {common_problem}, because I'm about to change your life...", energy_arc: { start: 'PEAK', middle: 'HIGH', end: 'HIGH' } },
    { name: 'Controversial Opinion', hook_type: 'challenge_belief', hook_score: 12, categories: ['supplements', 'skincare', 'fitness', 'tech', 'finance'], text_hook_template: 'Unpopular opinion: {controversial_stance}...', spoken_hook_template: "This is going to be controversial, but I don't care anymore. {Controversial_stance} and here's the proof...", energy_arc: { start: 'HIGH', middle: 'PEAK', end: 'HIGH' } },
    { name: 'Price Reveal Shock', hook_type: 'curiosity_gap', hook_score: 10, categories: ['fashion', 'home', 'tech', 'kitchen'], text_hook_template: "I can't believe this was only ${price}...", spoken_hook_template: "Okay so I found this {product} and when I tell you the price, you're not going to believe me...", energy_arc: { start: 'HIGH', middle: 'HIGH', end: 'PEAK' } },
    { name: 'Expert Endorsement', hook_type: 'challenge_belief', hook_score: 12, categories: ['supplements', 'skincare', 'baby', 'pet'], text_hook_template: 'As a {professional_title}, I never recommend {category}. Except this one...', spoken_hook_template: 'As a {professional_title} for {years} years, I almost never recommend {category} products to my clients. But this one is different...', energy_arc: { start: 'MEDIUM', middle: 'HIGH', end: 'HIGH' } },
    { name: 'Time Saver Discovery', hook_type: 'planted_question', hook_score: 11, categories: ['kitchen', 'home', 'tech', 'fitness'], text_hook_template: 'Why did nobody tell me about this sooner...', spoken_hook_template: "I'm actually mad that nobody told me about this sooner. This {product} just saved me {time/money}...", energy_arc: { start: 'HIGH', middle: 'HIGH', end: 'PEAK' } },
  ];

  const { data: insertedTemplates, error: templateError } = await supabase
    .from('script_template')
    .upsert(templates, { onConflict: 'name' })
    .select();

  if (templateError) {
    console.error('Error seeding templates:', templateError);
  } else {
    console.log(`Upserted ${insertedTemplates?.length || 0} script templates`);
  }

  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
