import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── AI Character ────────────────────────────────────────────────────────────

export const aiCharacter = pgTable('ai_character', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  appearance: text('appearance'),
  wardrobe: text('wardrobe'),
  setting: text('setting'),
  voiceDescription: text('voice_description'),
  voiceId: text('voice_id'),
  avatarPersona: text('avatar_persona'),
  categories: text('categories').array(),
  status: text('status').default('Active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const aiCharacterRelations = relations(aiCharacter, ({ many }) => ({
  projects: many(project),
}));

// ─── Influencer ─────────────────────────────────────────────────────────────

export const influencer = pgTable('influencer', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  persona: text('persona'),
  imageUrl: text('image_url'),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const influencerRelations = relations(influencer, ({ many }) => ({
  projects: many(project),
}));

// ─── Script Template ─────────────────────────────────────────────────────────

export const scriptTemplate = pgTable('script_template', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  hookType: text('hook_type'),
  textHookTemplate: text('text_hook_template'),
  spokenHookTemplate: text('spoken_hook_template'),
  energyArc: jsonb('energy_arc'),
  hookScore: integer('hook_score'),
  categories: text('categories').array(),
  timesUsed: integer('times_used').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const scriptTemplateRelations = relations(scriptTemplate, ({ many }) => ({
  projects: many(project),
}));

// ─── Project ─────────────────────────────────────────────────────────────────

export const project = pgTable('project', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  status: text('status').notNull().default('created'),
  productUrl: text('product_url').notNull(),
  productName: text('product_name'),
  productCategory: text('product_category'),
  productData: jsonb('product_data'),
  characterId: uuid('character_id').references(() => aiCharacter.id),
  scriptTemplateId: uuid('script_template_id').references(() => scriptTemplate.id),
  tone: text('tone').default('reluctant-insider'),
  influencerId: uuid('influencer_id').references(() => influencer.id),
  inputMode: text('input_mode').default('product_only'),
  videoUrl: text('video_url'),
  previewOnly: boolean('preview_only').default(false),
  renderUrl: text('render_url'),
  costUsd: numeric('cost_usd', { precision: 10, scale: 4 }).default('0'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const projectRelations = relations(project, ({ one, many }) => ({
  character: one(aiCharacter, {
    fields: [project.characterId],
    references: [aiCharacter.id],
  }),
  scriptTemplate: one(scriptTemplate, {
    fields: [project.scriptTemplateId],
    references: [scriptTemplate.id],
  }),
  influencer: one(influencer, {
    fields: [project.influencerId],
    references: [influencer.id],
  }),
  scripts: many(script),
  assets: many(asset),
  completedRuns: many(completedRun),
}));

// ─── Script ──────────────────────────────────────────────────────────────────

export const script = pgTable('script', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => project.id),
  version: integer('version').default(1),
  hookScore: integer('hook_score'),
  grade: text('grade'),
  isFavorite: boolean('is_favorite').default(false),
  feedback: text('feedback'),
  fullText: text('full_text'),
  tone: text('tone'),
  source: text('source').default('generated'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const scriptRelations = relations(script, ({ one, many }) => ({
  project: one(project, {
    fields: [script.projectId],
    references: [project.id],
  }),
  scenes: many(scene),
}));

// ─── Scene ───────────────────────────────────────────────────────────────────

export const scene = pgTable('scene', {
  id: uuid('id').primaryKey().defaultRandom(),
  scriptId: uuid('script_id')
    .notNull()
    .references(() => script.id),
  segmentIndex: integer('segment_index').notNull(),
  section: text('section').notNull(),
  scriptText: text('script_text'),
  syllableCount: integer('syllable_count'),
  energyArc: jsonb('energy_arc'),
  shotScripts: jsonb('shot_scripts'),
  audioSync: jsonb('audio_sync'),
  textOverlay: text('text_overlay'),
  visualPrompt: jsonb('visual_prompt'),
  productVisibility: text('product_visibility'),
  tone: text('tone'),
  version: integer('version').default(1),
  createdAt: timestamp('created_at').defaultNow(),
});

export const sceneRelations = relations(scene, ({ one, many }) => ({
  script: one(script, {
    fields: [scene.scriptId],
    references: [script.id],
  }),
  assets: many(asset),
}));

// ─── Asset ───────────────────────────────────────────────────────────────────

export const asset = pgTable('asset', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => project.id),
  sceneId: uuid('scene_id').references(() => scene.id),
  type: text('type').notNull(),
  url: text('url'),
  provider: text('provider'),
  providerTaskId: text('provider_task_id'),
  status: text('status').default('pending'),
  grade: text('grade'),
  costUsd: numeric('cost_usd', { precision: 10, scale: 4 }).default('0'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const assetRelations = relations(asset, ({ one }) => ({
  project: one(project, {
    fields: [asset.projectId],
    references: [project.id],
  }),
  scene: one(scene, {
    fields: [asset.sceneId],
    references: [scene.id],
  }),
}));

// ─── Completed Run ──────────────────────────────────────────────────────────

export const completedRun = pgTable('completed_run', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => project.id),
  productData: jsonb('product_data'),
  scriptSnapshot: jsonb('script_snapshot'),
  tone: text('tone'),
  characterName: text('character_name'),
  influencerName: text('influencer_name'),
  hookScore: integer('hook_score'),
  assetUrls: jsonb('asset_urls'),
  finalVideoUrl: text('final_video_url'),
  totalCostUsd: numeric('total_cost_usd'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const completedRunRelations = relations(completedRun, ({ one }) => ({
  project: one(project, {
    fields: [completedRun.projectId],
    references: [project.id],
  }),
}));
