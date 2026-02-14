# TikTok Creator App - Roadmap

## Phase 1: MVP (Current)
- [x] Project scaffold (Next.js + Tailwind + TypeScript)
- [x] Database schema (6 tables, Drizzle ORM + Supabase)
- [x] ProductAnalyzerAgent (WaveSpeed LLM)
- [x] BullMQ pipeline queue + worker
- [x] Dashboard, create project, project detail pages
- [ ] Push DB schema + seed data to Supabase
- [ ] End-to-end test with real product URL

## Phase 2: Scripting
- [ ] ScriptingAgent (4-segment script generation)
- [ ] Script review page (approve/grade/regenerate)
- [ ] Hook scoring validation

## Phase 3: Asset Generation
- [ ] CastingAgent (Nano Banana Pro keyframes)
- [ ] DirectorAgent (Kling 3.0 Pro video generation)
- [ ] VoiceoverAgent (ElevenLabs TTS)
- [ ] Asset review page (per-asset grading)

## Phase 4: Video Editing
- [ ] EditorAgent (Creatomate integration)
- [ ] Final review page (video player + download)

## Phase 5: CLI Mode
- [ ] Headless execution (`npm run generate -- --topic="..."`)
- [ ] Auto-approve mode for batch generation

## Phase 6: FFmpeg Renderer
- [ ] Replace Creatomate with local FFmpeg rendering
- [ ] Custom text overlay and transitions
