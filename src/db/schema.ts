import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  jsonb,
  timestamp,
  date,
  bigint,
  uniqueIndex,
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
  voiceId: text('voice_id'),
  voiceDescription: text('voice_description'),
  voicePreviewUrl: text('voice_preview_url'),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const influencerRelations = relations(influencer, ({ many }) => ({
  projects: many(project),
}));

// ─── Product ────────────────────────────────────────────────────────────────

export const product = pgTable('product', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: text('url').notNull().unique(),
  name: text('name'),
  brand: text('brand'),
  category: text('category'),
  productType: text('product_type'),
  productSize: text('product_size'),
  productPrice: text('product_price'),
  sellingPoints: jsonb('selling_points').default([]),
  keyClaims: jsonb('key_claims').default([]),
  benefits: jsonb('benefits').default([]),
  usage: text('usage'),
  hookAngle: text('hook_angle'),
  avatarDescription: text('avatar_description'),
  imageDescription: text('image_description'),
  imageUrl: text('image_url'),
  analysisData: jsonb('analysis_data'),
  overrides: jsonb('overrides').default({}),
  status: text('status').notNull().default('created'),
  errorMessage: text('error_message'),
  costUsd: numeric('cost_usd', { precision: 10, scale: 4 }).default('0'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const productRelations = relations(product, ({ many }) => ({
  projects: many(project),
  images: many(productImage),
}));

// ─── Product Image ─────────────────────────────────────────────────────────

export const productImage = pgTable('product_image', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => product.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  urlClean: text('url_clean'),
  angle: text('angle').notNull().default('front'),
  isPrimary: boolean('is_primary').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow(),
});

export const productImageRelations = relations(productImage, ({ one }) => ({
  product: one(product, {
    fields: [productImage.productId],
    references: [product.id],
  }),
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
  productImageUrl: text('product_image_url'),
  productId: uuid('product_id').references(() => product.id),
  characterId: uuid('character_id').references(() => aiCharacter.id),
  scriptTemplateId: uuid('script_template_id').references(() => scriptTemplate.id),
  tone: text('tone').default('reluctant-insider'),
  influencerId: uuid('influencer_id').references(() => influencer.id),
  inputMode: text('input_mode').default('product_only'),
  videoUrl: text('video_url'),
  videoAnalysis: jsonb('video_analysis'),
  previewOnly: boolean('preview_only').default(false),
  renderUrl: text('render_url'),
  costUsd: numeric('cost_usd', { precision: 10, scale: 4 }).default('0'),
  errorMessage: text('error_message'),
  failedAtStatus: text('failed_at_status'),
  cancelRequestedAt: timestamp('cancel_requested_at'),
  videoRetries: integer('video_retries').notNull().default(0),
  productPlacement: jsonb('product_placement'),
  negativePromptOverride: jsonb('negative_prompt_override'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const projectRelations = relations(project, ({ one, many }) => ({
  product: one(product, {
    fields: [project.productId],
    references: [product.id],
  }),
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
  brollCues: jsonb('broll_cues'),
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

// ─── B-Roll Shot ────────────────────────────────────────────────────────────

export const brollShot = pgTable('broll_shot', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => project.id, { onDelete: 'cascade' }),
  scriptId: uuid('script_id')
    .notNull()
    .references(() => script.id, { onDelete: 'cascade' }),
  segmentIndex: integer('segment_index').notNull(),
  shotIndex: integer('shot_index').notNull(),
  category: text('category').notNull(),
  prompt: text('prompt').notNull(),
  narrativeRole: text('narrative_role'),
  timingSeconds: numeric('timing_seconds').notNull(),
  durationSeconds: numeric('duration_seconds').default('2.5'),
  source: text('source').notNull().default('ai_generated'),
  imageUrl: text('image_url'),
  status: text('status').notNull().default('planned'),
  assetId: uuid('asset_id').references(() => asset.id),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const brollShotRelations = relations(brollShot, ({ one }) => ({
  project: one(project, {
    fields: [brollShot.projectId],
    references: [project.id],
  }),
  script: one(script, {
    fields: [brollShot.scriptId],
    references: [script.id],
  }),
  asset: one(asset, {
    fields: [brollShot.assetId],
    references: [asset.id],
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

// ─── TikTok Connection ────────────────────────────────────────────────────────

export const tiktokConnection = pgTable('tiktok_connection', {
  id: uuid('id').primaryKey().defaultRandom(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tiktokOpenId: text('tiktok_open_id').notNull(),
  tiktokUsername: text('tiktok_username'),
  tiktokAvatarUrl: text('tiktok_avatar_url'),
  scopes: text('scopes').default('user.info.basic,video.list'),
  tokenExpiresAt: timestamp('token_expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ─── Video Performance ────────────────────────────────────────────────────────

export const videoPerformance = pgTable('video_performance', {
  id: uuid('id').primaryKey().defaultRandom(),
  completedRunId: uuid('completed_run_id')
    .notNull()
    .unique()
    .references(() => completedRun.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => project.id, { onDelete: 'cascade' }),
  tiktokPostUrl: text('tiktok_post_url'),
  tiktokVideoId: text('tiktok_video_id'),
  views: bigint('views', { mode: 'number' }).default(0),
  likes: integer('likes').default(0),
  comments: integer('comments').default(0),
  shares: integer('shares').default(0),
  avgWatchTimeSeconds: numeric('avg_watch_time_seconds', { precision: 8, scale: 2 }),
  completionRatePct: numeric('completion_rate_pct', { precision: 5, scale: 2 }),
  unitsSold: integer('units_sold').default(0),
  gmvUsd: numeric('gmv_usd', { precision: 12, scale: 2 }).default('0'),
  conversionRatePct: numeric('conversion_rate_pct', { precision: 5, scale: 2 }),
  addToCartRatePct: numeric('add_to_cart_rate_pct', { precision: 5, scale: 2 }),
  roi: numeric('roi', { precision: 8, scale: 2 }),
  performanceBadge: text('performance_badge'),
  dataSource: text('data_source').notNull().default('manual'),
  lastSyncedAt: timestamp('last_synced_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const videoPerformanceRelations = relations(videoPerformance, ({ one, many }) => ({
  completedRun: one(completedRun, {
    fields: [videoPerformance.completedRunId],
    references: [completedRun.id],
  }),
  project: one(project, {
    fields: [videoPerformance.projectId],
    references: [project.id],
  }),
  snapshots: many(performanceSnapshot),
}));

// ─── Performance Snapshot ─────────────────────────────────────────────────────

export const performanceSnapshot = pgTable('performance_snapshot', {
  id: uuid('id').primaryKey().defaultRandom(),
  videoPerformanceId: uuid('video_performance_id')
    .notNull()
    .references(() => videoPerformance.id, { onDelete: 'cascade' }),
  snapshotDate: date('snapshot_date').notNull(),
  daysSincePost: integer('days_since_post').notNull(),
  views: bigint('views', { mode: 'number' }).default(0),
  likes: integer('likes').default(0),
  comments: integer('comments').default(0),
  shares: integer('shares').default(0),
  unitsSold: integer('units_sold').default(0),
  gmvUsd: numeric('gmv_usd', { precision: 12, scale: 2 }).default('0'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const performanceSnapshotRelations = relations(performanceSnapshot, ({ one }) => ({
  videoPerformance: one(videoPerformance, {
    fields: [performanceSnapshot.videoPerformanceId],
    references: [videoPerformance.id],
  }),
}));
