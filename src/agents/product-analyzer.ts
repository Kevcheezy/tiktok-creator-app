import { SupabaseClient } from '@supabase/supabase-js';
import { BaseAgent } from './base-agent';
import { AVATAR_MAPPING, API_COSTS, PRODUCT_CATEGORIES, type ProductCategory } from '@/lib/constants';

export interface ProductAnalysis {
  product_name: string;
  brand: string;
  product_type: string;
  product_size: string;
  product_price: string;
  category: ProductCategory | string;
  selling_points: string[];
  key_claims: string[];
  usage: string;
  benefits: string[];
  hook_angle: string;
  product_image_url: string;
  image_description_for_nano_banana_pro: string;
  avatar_description: string;
}

const SYSTEM_PROMPT = `You are an expert product analyst for TikTok Shop UGC video production. Your job is to analyze product pages and extract structured data that will be used by downstream agents to write scripts and generate visuals.

You MUST respond with valid JSON only. No markdown, no code fences, no explanation text. Just the raw JSON object.

The JSON must have exactly these fields:
{
  "product_name": "Full product name as shown on the page",
  "brand": "Brand name (e.g. 'NeoCell')",
  "product_type": "Product type (e.g. 'Collagen Protein Powder')",
  "product_size": "Size and supply info (e.g. '20 oz - 28 day supply')",
  "product_price": "Price and retailer (e.g. '$22.99 at TikTok Shop')",
  "category": "One of: supplements, skincare, fitness, tech, kitchen, fashion, home, baby, pet, finance",
  "selling_points": ["Array of 3-5 key selling points that make this product stand out"],
  "key_claims": ["Array of 3-5 factual/numerical claims (e.g. '20g collagen per serving')"],
  "usage": "How to use the product (1-2 sentences)",
  "benefits": ["Array of 3-5 key benefits for the consumer"],
  "hook_angle": "The emotional or logical hook strategy for a 60-second UGC video. What will make viewers stop scrolling?",
  "product_image_url": "Main product image URL if visible on the page, otherwise empty string",
  "image_description_for_nano_banana_pro": "Detailed visual description of the product packaging for AI image generation. Include: container type, colors, label design, any distinguishing features",
  "avatar_description": "Description of the ideal authority figure to present this product. Include: profession, appearance, wardrobe, setting"
}

RULES:
- category MUST be one of the 10 listed categories
- selling_points should focus on what makes THIS product unique vs competitors
- key_claims should be factual, verifiable claims with numbers when possible
- hook_angle should be a specific strategy, not generic (e.g. "Challenge the belief that expensive skincare is needed when collagen works from within")
- avatar_description should match the product category (pharmacist for supplements, trainer for fitness, etc.)
- If you cannot access the URL, infer what you can from the URL structure and any provided context`;

export class ProductAnalyzerAgent extends BaseAgent {
  constructor(supabaseClient?: SupabaseClient) {
    super('ProductAnalyzerAgent', supabaseClient);
  }

  async run(projectId: string): Promise<ProductAnalysis> {
    this.log(`Starting analysis for project ${projectId}`);

    // 1. Fetch project from DB
    const { data: proj, error } = await this.supabase
      .from('project')
      .select('*, character:ai_character(*)')
      .eq('id', projectId)
      .single();

    if (error || !proj) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // 2. Build user prompt
    const userPrompt = this.buildUserPrompt(proj);

    // 3. Call WaveSpeed LLM
    this.log('Calling WaveSpeed LLM for product analysis...');
    let rawResponse: string;
    try {
      rawResponse = await this.wavespeed.chatCompletion(SYSTEM_PROMPT, userPrompt, {
        temperature: 0.3,
        maxTokens: 4096,
      });
    } catch (error) {
      throw new Error(`LLM call failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 4. Parse JSON response
    this.log('Parsing LLM response...');
    let analysis: ProductAnalysis;
    try {
      // Strip markdown code fences if present
      const cleaned = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleaned);
    } catch (error) {
      throw new Error(
        `Failed to parse LLM response as JSON: ${error instanceof Error ? error.message : String(error)}\nRaw response: ${rawResponse.substring(0, 500)}`
      );
    }

    // 5. Validate category
    const validCategories: readonly string[] = PRODUCT_CATEGORIES;
    if (!validCategories.includes(analysis.category)) {
      this.log(`Warning: Invalid category "${analysis.category}", defaulting to "supplements"`);
      analysis.category = 'supplements';
    }

    // 6. Apply avatar mapping if no custom character
    if (!proj.character) {
      const mapping = AVATAR_MAPPING[analysis.category];
      if (mapping) {
        analysis.avatar_description = `${mapping.title}. ${mapping.appearance}. Wearing ${mapping.wardrobe}. Setting: ${mapping.setting}`;
        this.log(`Applied avatar mapping for category: ${analysis.category} -> ${mapping.title}`);
      }
    } else {
      const char = proj.character;
      analysis.avatar_description = `${char.name}. ${char.appearance}. Wearing ${char.wardrobe}. Setting: ${char.setting}`;
      this.log(`Using custom character: ${char.name}`);
    }

    // 7. Track cost
    await this.trackCost(projectId, API_COSTS.wavespeedChat);

    this.log('Analysis complete');
    return analysis;
  }

  private buildUserPrompt(proj: {
    product_url: string;
    product_name: string | null;
    product_category: string | null;
    product_data: unknown;
  }): string {
    let prompt = `Analyze this TikTok Shop product page and extract structured data:\n\nProduct URL: ${proj.product_url}`;

    if (proj.product_name) {
      prompt += `\nKnown product name: ${proj.product_name}`;
    }
    if (proj.product_category) {
      prompt += `\nKnown category: ${proj.product_category}`;
    }
    if (proj.product_data && typeof proj.product_data === 'object') {
      prompt += `\nExisting product data: ${JSON.stringify(proj.product_data)}`;
    }

    return prompt;
  }
}
