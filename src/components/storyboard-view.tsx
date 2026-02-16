'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// =============================================
// Types
// =============================================

interface BrollShot {
  id: string;
  project_id: string;
  segment_index: number;
  shot_index: number;
  category: string;
  prompt: string;
  narrative_role: string;
  timing_seconds: number;
  duration_seconds: number;
  source: 'ai_generated' | 'user_uploaded';
  image_url: string | null;
  status: 'planned' | 'generating' | 'completed' | 'replaced' | 'removed';
}

interface SegmentInfo {
  index: number;
  section: string;
  script_text: string;
  syllable_count: number;
  shot_scripts: { index: number; text: string }[];
}

interface StoryboardViewProps {
  projectId: string;
  onStatusChange?: () => void;
}

// =============================================
// Constants
// =============================================

const CATEGORY_COLORS: Record<string, string> = {
  transformation: 'magenta',
  research: 'electric',
  lifestyle: 'lime',
  social_proof: 'amber-hot',
  unboxing: 'electric',
  comparison: 'magenta',
  texture: 'lime',
  routine: 'electric',
  ingredients: 'amber-hot',
  action: 'magenta',
  setup: 'electric',
  results: 'lime',
  cooking: 'amber-hot',
  before_after: 'magenta',
  plating: 'lime',
  styling: 'magenta',
  detail: 'electric',
  space: 'lime',
  safety: 'amber-hot',
  usage: 'electric',
  reaction: 'magenta',
  data: 'electric',
};

const ALL_CATEGORIES = [
  'transformation', 'research', 'lifestyle', 'social_proof', 'unboxing',
  'comparison', 'texture', 'routine', 'ingredients', 'action', 'setup',
  'results', 'cooking', 'before_after', 'plating', 'styling', 'detail',
  'space', 'safety', 'usage', 'reaction', 'data',
];

const SEGMENT_TIME_RANGES = ['0:00 - 0:15', '0:15 - 0:30', '0:30 - 0:45', '0:45 - 1:00'];

const COST_PER_SHOT = 0.07;

// =============================================
// Mock Data
// =============================================

const MOCK_SEGMENTS: SegmentInfo[] = [
  {
    index: 0,
    section: 'HOOK',
    script_text: 'I spent $200 on collagen supplements last year and saw ZERO results. Then my dermatologist told me something that changed everything.',
    syllable_count: 38,
    shot_scripts: [
      { index: 0, text: 'Close-up of frustrated expression holding empty supplement bottles' },
      { index: 1, text: 'Quick cuts of various collagen products being tossed aside' },
      { index: 2, text: 'Dramatic pause with eye contact to camera' },
    ],
  },
  {
    index: 1,
    section: 'PROBLEM',
    script_text: 'Most collagen supplements break down in your stomach before they ever reach your skin. The molecules are too large to absorb. Studies show 90% of powder collagen never makes it to your dermis.',
    syllable_count: 52,
    shot_scripts: [
      { index: 0, text: 'Animated diagram showing collagen molecules in stomach acid' },
      { index: 1, text: 'Split screen comparing molecule sizes with absorption rates' },
      { index: 2, text: 'Research paper highlights with key statistics circled' },
      { index: 3, text: 'Before photos of dull, dehydrated skin texture' },
    ],
  },
  {
    index: 2,
    section: 'SOLUTION + PRODUCT',
    script_text: 'This brand uses nano-hydrolyzed peptides that are 50x smaller than regular collagen. They actually reach your skin cells. After 30 days my fine lines faded and my skin literally glows.',
    syllable_count: 48,
    shot_scripts: [
      { index: 0, text: 'Product reveal with premium unboxing moment' },
      { index: 1, text: 'Microscopic comparison of nano-peptides vs regular collagen' },
      { index: 2, text: 'Daily routine montage showing product usage' },
      { index: 3, text: 'Side-by-side before/after of skin texture improvement' },
    ],
  },
  {
    index: 3,
    section: 'CTA',
    script_text: 'Link is in my bio. Use code GLOW30 for 30% off your first order. Your future skin will thank you.',
    syllable_count: 28,
    shot_scripts: [
      { index: 0, text: 'Confident smile holding product to camera' },
      { index: 1, text: 'Text overlay animation with discount code' },
      { index: 2, text: 'Final glowing skin close-up with product in frame' },
    ],
  },
];

function createMockShots(projectId: string): BrollShot[] {
  return [
    // Segment 0 - HOOK
    {
      id: 'broll-001',
      project_id: projectId,
      segment_index: 0,
      shot_index: 0,
      category: 'transformation',
      prompt: 'Close-up of a woman\'s hand dropping empty collagen supplement bottles into a bathroom trash can, frustration evident, soft warm lighting',
      narrative_role: 'Establishes relatable pain point of wasted money',
      timing_seconds: 0,
      duration_seconds: 2.5,
      source: 'ai_generated',
      image_url: null,
      status: 'planned',
    },
    {
      id: 'broll-002',
      project_id: projectId,
      segment_index: 0,
      shot_index: 1,
      category: 'lifestyle',
      prompt: 'Aesthetic flat-lay of various collagen powder containers and pills scattered on a marble countertop, overhead shot, moody lighting',
      narrative_role: 'Visual proof of supplement overwhelm',
      timing_seconds: 2.5,
      duration_seconds: 2,
      source: 'ai_generated',
      image_url: null,
      status: 'planned',
    },
    {
      id: 'broll-003',
      project_id: projectId,
      segment_index: 0,
      shot_index: 2,
      category: 'transformation',
      prompt: 'Macro shot of a dermatologist\'s hands holding a molecular diagram, clinical office background, blue-tinted lighting',
      narrative_role: 'Transitions to authority/expertise moment',
      timing_seconds: 5,
      duration_seconds: 2.5,
      source: 'ai_generated',
      image_url: null,
      status: 'planned',
    },
    {
      id: 'broll-004',
      project_id: projectId,
      segment_index: 0,
      shot_index: 3,
      category: 'social_proof',
      prompt: 'Phone screen showing receipt totals for collagen supplements adding up to $200+, scrolling through purchase history',
      narrative_role: 'Reinforces the monetary pain point with concrete proof',
      timing_seconds: 7.5,
      duration_seconds: 2,
      source: 'ai_generated',
      image_url: null,
      status: 'planned',
    },
    // Segment 1 - PROBLEM
    {
      id: 'broll-005',
      project_id: projectId,
      segment_index: 1,
      shot_index: 0,
      category: 'research',
      prompt: 'CGI-style animation of collagen molecules dissolving in stomach acid, warm orange tones representing digestive environment',
      narrative_role: 'Visualizes the scientific problem for viewer comprehension',
      timing_seconds: 15,
      duration_seconds: 3,
      source: 'ai_generated',
      image_url: null,
      status: 'planned',
    },
    {
      id: 'broll-006',
      project_id: projectId,
      segment_index: 1,
      shot_index: 1,
      category: 'research',
      prompt: 'Split-screen infographic comparing large collagen molecules vs nano-hydrolyzed peptides with size measurements, clean minimal design',
      narrative_role: 'Data visualization making the science accessible',
      timing_seconds: 18,
      duration_seconds: 2.5,
      source: 'ai_generated',
      image_url: null,
      status: 'planned',
    },
    {
      id: 'broll-007',
      project_id: projectId,
      segment_index: 1,
      shot_index: 2,
      category: 'research',
      prompt: 'Close-up of a published research paper with "90% absorption failure" highlighted in yellow marker, shallow depth of field',
      narrative_role: 'Grounds the claim in scientific evidence',
      timing_seconds: 20.5,
      duration_seconds: 2,
      source: 'ai_generated',
      image_url: null,
      status: 'planned',
    },
    {
      id: 'broll-008',
      project_id: projectId,
      segment_index: 1,
      shot_index: 3,
      category: 'transformation',
      prompt: 'Extreme macro shot of dehydrated skin texture showing fine lines and dullness, clinical lighting, slightly desaturated',
      narrative_role: 'Makes the problem tangible and personal',
      timing_seconds: 22.5,
      duration_seconds: 2.5,
      source: 'ai_generated',
      image_url: null,
      status: 'planned',
    },
    {
      id: 'broll-009',
      project_id: projectId,
      segment_index: 1,
      shot_index: 4,
      category: 'social_proof',
      prompt: 'Scrolling through negative reviews of competitor collagen supplements on phone screen, highlighting "didn\'t work" comments',
      narrative_role: 'Social proof that this is a universal problem',
      timing_seconds: 25,
      duration_seconds: 2,
      source: 'ai_generated',
      image_url: null,
      status: 'planned',
    },
    // Segment 2 - SOLUTION + PRODUCT
    {
      id: 'broll-010',
      project_id: projectId,
      segment_index: 2,
      shot_index: 0,
      category: 'lifestyle',
      prompt: 'Premium product unboxing reveal with tissue paper and branded packaging, hands gently opening box, soft natural lighting',
      narrative_role: 'Creates aspirational moment around the product reveal',
      timing_seconds: 30,
      duration_seconds: 3,
      source: 'ai_generated',
      image_url: null,
      status: 'planned',
    },
    {
      id: 'broll-011',
      project_id: projectId,
      segment_index: 2,
      shot_index: 1,
      category: 'research',
      prompt: 'Side-by-side microscopic comparison showing nano-hydrolyzed peptides 50x smaller than regular collagen molecules, electron microscope aesthetic',
      narrative_role: 'Scientific proof of product differentiation',
      timing_seconds: 33,
      duration_seconds: 2.5,
      source: 'ai_generated',
      image_url: null,
      status: 'planned',
    },
    {
      id: 'broll-012',
      project_id: projectId,
      segment_index: 2,
      shot_index: 2,
      category: 'lifestyle',
      prompt: 'Morning routine montage: stirring collagen into coffee, taking supplement with water, applying moisturizer, bright airy bathroom',
      narrative_role: 'Shows effortless integration into daily life',
      timing_seconds: 35.5,
      duration_seconds: 3,
      source: 'ai_generated',
      image_url: null,
      status: 'planned',
    },
    {
      id: 'broll-013',
      project_id: projectId,
      segment_index: 2,
      shot_index: 3,
      category: 'transformation',
      prompt: 'Dramatic before/after split screen of skin texture improvement over 30 days, clear lighting, same angle and distance',
      narrative_role: 'Visual proof of transformation delivering the promise',
      timing_seconds: 38.5,
      duration_seconds: 3,
      source: 'ai_generated',
      image_url: null,
      status: 'planned',
    },
    {
      id: 'broll-014',
      project_id: projectId,
      segment_index: 2,
      shot_index: 4,
      category: 'social_proof',
      prompt: 'Screenshot montage of glowing 5-star reviews mentioning "visible results" and "finally works", phone screen scroll',
      narrative_role: 'Third-party validation of product claims',
      timing_seconds: 41.5,
      duration_seconds: 2,
      source: 'ai_generated',
      image_url: null,
      status: 'planned',
    },
    // Segment 3 - CTA
    {
      id: 'broll-015',
      project_id: projectId,
      segment_index: 3,
      shot_index: 0,
      category: 'lifestyle',
      prompt: 'Confident creator holding product bottle at eye level with genuine smile, warm golden hour lighting, shallow depth of field',
      narrative_role: 'Personal endorsement creating trust',
      timing_seconds: 45,
      duration_seconds: 2.5,
      source: 'ai_generated',
      image_url: null,
      status: 'planned',
    },
    {
      id: 'broll-016',
      project_id: projectId,
      segment_index: 3,
      shot_index: 1,
      category: 'social_proof',
      prompt: 'Animated text overlay "GLOW30" with 30% discount badge, brand colors, clean motion graphics on dark background',
      narrative_role: 'Clear call-to-action with urgency element',
      timing_seconds: 47.5,
      duration_seconds: 2,
      source: 'ai_generated',
      image_url: null,
      status: 'planned',
    },
    {
      id: 'broll-017',
      project_id: projectId,
      segment_index: 3,
      shot_index: 2,
      category: 'transformation',
      prompt: 'Final beauty shot of radiant glowing skin with product artfully placed in foreground, ethereal backlighting, dreamy feel',
      narrative_role: 'Aspirational closing image reinforcing the transformation promise',
      timing_seconds: 49.5,
      duration_seconds: 2.5,
      source: 'ai_generated',
      image_url: null,
      status: 'planned',
    },
    {
      id: 'broll-018',
      project_id: projectId,
      segment_index: 3,
      shot_index: 3,
      category: 'lifestyle',
      prompt: 'Overhead shot of the full product line arranged on clean white surface with botanical elements, editorial style',
      narrative_role: 'Brand elevation moment before viewer clicks',
      timing_seconds: 52,
      duration_seconds: 2,
      source: 'ai_generated',
      image_url: null,
      status: 'planned',
    },
  ];
}

// =============================================
// Helpers
// =============================================

function getCategoryColorClasses(category: string): { bg: string; text: string; border: string } {
  const color = CATEGORY_COLORS[category] || 'electric';
  return {
    bg: `bg-${color}/15`,
    text: `text-${color}`,
    border: `border-${color}/30`,
  };
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.round((seconds % 1) * 10);
  if (tenths > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

let nextId = 100;
function generateId(): string {
  nextId++;
  return `broll-new-${nextId}`;
}

// =============================================
// Main Component
// =============================================

export function StoryboardView({ projectId, onStatusChange }: StoryboardViewProps) {
  const [shots, setShots] = useState<BrollShot[]>(() => createMockShots(projectId));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<BrollShot>>({});
  const [removedUndo, setRemovedUndo] = useState<{ id: string; timeout: ReturnType<typeof setTimeout> } | null>(null);
  const [approving, setApproving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<string | null>(null);

  // Clean up undo timeout on unmount
  useEffect(() => {
    return () => {
      if (removedUndo) clearTimeout(removedUndo.timeout);
    };
  }, [removedUndo]);

  // ---- Computed values ----
  const activeShots = shots.filter((s) => s.status !== 'removed');
  const aiGeneratedCount = activeShots.filter((s) => s.source === 'ai_generated').length;
  const estimatedCost = aiGeneratedCount * COST_PER_SHOT;

  const categoryBreakdown = activeShots.reduce<Record<string, number>>((acc, s) => {
    acc[s.category] = (acc[s.category] || 0) + 1;
    return acc;
  }, {});

  // ---- Handlers ----

  const startEdit = useCallback((shot: BrollShot) => {
    setEditingId(shot.id);
    setEditDraft({
      prompt: shot.prompt,
      category: shot.category,
      timing_seconds: shot.timing_seconds,
      duration_seconds: shot.duration_seconds,
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft({});
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingId) return;
    setShots((prev) =>
      prev.map((s) =>
        s.id === editingId
          ? {
              ...s,
              prompt: editDraft.prompt ?? s.prompt,
              category: editDraft.category ?? s.category,
              timing_seconds: editDraft.timing_seconds ?? s.timing_seconds,
              duration_seconds: editDraft.duration_seconds ?? s.duration_seconds,
            }
          : s
      )
    );
    setEditingId(null);
    setEditDraft({});
  }, [editingId, editDraft]);

  const removeShot = useCallback((shotId: string) => {
    setShots((prev) => prev.map((s) => (s.id === shotId ? { ...s, status: 'removed' as const } : s)));

    // Clear previous undo if any
    if (removedUndo) clearTimeout(removedUndo.timeout);

    const timeout = setTimeout(() => {
      setRemovedUndo(null);
    }, 5000);

    setRemovedUndo({ id: shotId, timeout });
  }, [removedUndo]);

  const undoRemove = useCallback(() => {
    if (!removedUndo) return;
    clearTimeout(removedUndo.timeout);
    setShots((prev) => prev.map((s) => (s.id === removedUndo.id ? { ...s, status: 'planned' as const } : s)));
    setRemovedUndo(null);
  }, [removedUndo]);

  const handleReplace = useCallback((shotId: string) => {
    replaceTargetRef.current = shotId;
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replaceTargetRef.current) return;

    const blobUrl = URL.createObjectURL(file);
    const targetId = replaceTargetRef.current;

    // TODO: POST /api/projects/${projectId}/broll/${targetId}/upload
    setShots((prev) =>
      prev.map((s) =>
        s.id === targetId
          ? { ...s, source: 'user_uploaded' as const, image_url: blobUrl, status: 'completed' as const }
          : s
      )
    );

    replaceTargetRef.current = null;
    e.target.value = '';
  }, []);

  const addShot = useCallback((segmentIndex: number, shotScriptIndex: number) => {
    const segmentShots = shots.filter((s) => s.segment_index === segmentIndex && s.status !== 'removed');
    const lastTiming = segmentShots.length > 0
      ? Math.max(...segmentShots.map((s) => s.timing_seconds + s.duration_seconds))
      : segmentIndex * 15;

    const newShot: BrollShot = {
      id: generateId(),
      project_id: projectId,
      segment_index: segmentIndex,
      shot_index: shotScriptIndex,
      category: 'lifestyle',
      prompt: '',
      narrative_role: '',
      timing_seconds: lastTiming,
      duration_seconds: 2,
      source: 'ai_generated',
      image_url: null,
      status: 'planned',
    };

    setShots((prev) => [...prev, newShot]);
    startEdit(newShot);
  }, [shots, projectId, startEdit]);

  const handleApprove = useCallback(async () => {
    setApproving(true);
    // TODO: POST /api/projects/${projectId}/broll/approve
    // Simulate a brief delay for UX
    await new Promise((resolve) => setTimeout(resolve, 400));
    setApproving(false);
    onStatusChange?.();
  }, [projectId, onStatusChange]);

  // ---- Render ----

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Hidden file input for image uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Summary Bar (sticky) */}
      <div className="sticky top-0 z-20 rounded-xl border border-border bg-surface/95 p-4 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Total shots badge */}
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-raised px-3 py-1.5">
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-electric" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                <rect x="2" y="2" width="5" height="5" rx="1" />
                <rect x="9" y="2" width="5" height="5" rx="1" />
                <rect x="2" y="9" width="5" height="5" rx="1" />
                <rect x="9" y="9" width="5" height="5" rx="1" />
              </svg>
              <span className="font-[family-name:var(--font-mono)] text-xs text-text-primary">
                {activeShots.length} shots
              </span>
            </span>

            {/* Estimated cost */}
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-raised px-3 py-1.5">
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-amber-hot" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                <circle cx="8" cy="8" r="6" />
                <path d="M8 4.5v7M5.5 6.5h4a1 1 0 010 2h-3a1 1 0 000 2h4" />
              </svg>
              <span className="font-[family-name:var(--font-mono)] text-xs text-amber-hot">
                ${estimatedCost.toFixed(2)}
              </span>
            </span>

            {/* Category breakdown pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {Object.entries(categoryBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, count]) => {
                  const colors = getCategoryColorClasses(cat);
                  return (
                    <span
                      key={cat}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text} ${colors.border}`}
                    >
                      {cat.replace('_', ' ')}
                      <span className="font-[family-name:var(--font-mono)] text-[9px] opacity-70">{count}</span>
                    </span>
                  );
                })}
            </div>
          </div>

          {/* Approve button */}
          <button
            type="button"
            onClick={handleApprove}
            disabled={approving}
            className="inline-flex items-center gap-2 rounded-lg bg-lime px-5 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_32px_rgba(184,255,0,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {approving ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
                </svg>
                Approving...
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3.5 8 6.5 11 12.5 5" />
                </svg>
                Approve &amp; Continue
              </>
            )}
          </button>
        </div>
      </div>

      {/* Undo toast */}
      {removedUndo && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-in-up rounded-lg border border-border bg-surface-raised px-4 py-2.5 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">Shot removed.</span>
            <button
              type="button"
              onClick={undoRemove}
              className="font-[family-name:var(--font-display)] text-sm font-semibold text-electric transition-colors hover:text-electric/80"
            >
              Undo
            </button>
          </div>
        </div>
      )}

      {/* Segment Sections */}
      <div className="stagger-children space-y-8">
        {MOCK_SEGMENTS.map((segment) => {
          const segmentShots = shots.filter((s) => s.segment_index === segment.index);
          const segmentActiveShots = segmentShots.filter((s) => s.status !== 'removed');
          const segmentAiCount = segmentActiveShots.filter((s) => s.source === 'ai_generated').length;
          const segmentCost = segmentAiCount * COST_PER_SHOT;

          return (
            <div key={segment.index} className="rounded-xl border border-border bg-surface overflow-hidden">
              {/* Segment Header */}
              <div className="border-b border-border bg-surface-raised/50 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-overlay font-[family-name:var(--font-mono)] text-xs font-bold text-text-muted">
                      {segment.index}
                    </span>
                    <h3 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-wider text-text-primary">
                      {segment.section}
                    </h3>
                    <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
                      {SEGMENT_TIME_RANGES[segment.index]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
                      {segment.syllable_count} syl
                    </span>
                    <span className="rounded-md bg-surface-overlay px-2 py-0.5 font-[family-name:var(--font-mono)] text-[11px] text-text-secondary">
                      {segmentActiveShots.length} shots
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-[11px] text-amber-hot">
                      ${segmentCost.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Segment Content with timeline border */}
              <div className="border-l-2 border-border ml-3 pl-5 py-4 pr-4 space-y-5">
                {segment.shot_scripts.map((shotScript) => {
                  const relatedShots = segmentShots.filter((s) => s.shot_index === shotScript.index);

                  return (
                    <div key={shotScript.index} className="space-y-3">
                      {/* Shot Script Card */}
                      <div className="rounded-lg border border-border/60 bg-surface-raised/30 px-4 py-2.5">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-surface-overlay font-[family-name:var(--font-mono)] text-[9px] font-bold text-text-muted">
                            {shotScript.index + 1}
                          </span>
                          <p className="text-sm leading-relaxed text-text-secondary">
                            {shotScript.text}
                          </p>
                        </div>
                      </div>

                      {/* B-Roll Cards for this shot script */}
                      <div className="space-y-2 pl-2">
                        {relatedShots.map((shot) => (
                          <BrollCard
                            key={shot.id}
                            shot={shot}
                            isEditing={editingId === shot.id}
                            editDraft={editingId === shot.id ? editDraft : undefined}
                            onStartEdit={() => startEdit(shot)}
                            onCancelEdit={cancelEdit}
                            onSaveEdit={saveEdit}
                            onEditDraftChange={setEditDraft}
                            onRemove={() => removeShot(shot.id)}
                            onReplace={() => handleReplace(shot.id)}
                          />
                        ))}
                      </div>

                      {/* Add B-Roll button */}
                      <button
                        type="button"
                        onClick={() => addShot(segment.index, shotScript.index)}
                        className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-text-muted transition-all hover:border-electric/40 hover:text-electric"
                      >
                        <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                          <line x1="8" y1="3" x2="8" y2="13" />
                          <line x1="3" y1="8" x2="13" y2="8" />
                        </svg>
                        Add B-roll
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================
// B-Roll Card Sub-component
// =============================================

interface BrollCardProps {
  shot: BrollShot;
  isEditing: boolean;
  editDraft?: Partial<BrollShot>;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditDraftChange: (draft: Partial<BrollShot>) => void;
  onRemove: () => void;
  onReplace: () => void;
}

function BrollCard({
  shot,
  isEditing,
  editDraft,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditDraftChange,
  onRemove,
  onReplace,
}: BrollCardProps) {
  const isRemoved = shot.status === 'removed';
  const colors = getCategoryColorClasses(isEditing && editDraft?.category ? editDraft.category : shot.category);

  return (
    <div
      className={`group rounded-lg border bg-surface p-4 transition-all ${
        isRemoved
          ? 'border-border/50 opacity-60'
          : 'border-border hover:border-border-bright'
      }`}
    >
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="flex-shrink-0">
          {shot.image_url ? (
            <div className="h-[72px] w-[72px] overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.image_url}
                alt={`B-roll: ${shot.category}`}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-lg border border-dashed border-border bg-surface-raised">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-text-muted" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-2">
          {/* Category badge + timing */}
          <div className="flex flex-wrap items-center gap-2">
            {isEditing ? (
              <select
                value={editDraft?.category || shot.category}
                onChange={(e) => onEditDraftChange({ ...editDraft, category: e.target.value })}
                className={`appearance-none rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all focus:outline-none focus:ring-1 focus:ring-electric ${colors.bg} ${colors.text} ${colors.border}`}
              >
                {ALL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-surface text-text-primary">
                    {cat.replace('_', ' ')}
                  </option>
                ))}
              </select>
            ) : (
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${colors.bg} ${colors.text} ${colors.border}`}
              >
                {shot.category.replace('_', ' ')}
              </span>
            )}

            <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
              @{shot.timing_seconds}s
            </span>
            <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
              {shot.duration_seconds}s
            </span>

            {shot.source === 'user_uploaded' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-lime/10 border border-lime/20 px-2 py-0.5 text-[10px] font-medium text-lime">
                <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                  <path d="M6 8V3M4 5l2-2 2 2" />
                </svg>
                uploaded
              </span>
            )}
          </div>

          {/* Prompt text */}
          {isEditing ? (
            <textarea
              value={editDraft?.prompt ?? shot.prompt}
              onChange={(e) => onEditDraftChange({ ...editDraft, prompt: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/60 transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
              placeholder="Describe the B-roll shot..."
            />
          ) : (
            <p className={`text-sm leading-relaxed text-text-secondary ${isRemoved ? 'line-through opacity-40' : ''}`}>
              {shot.prompt || <span className="italic text-text-muted">No prompt set</span>}
            </p>
          )}

          {/* Narrative role */}
          {!isEditing && shot.narrative_role && (
            <p className="text-xs italic text-text-muted">
              {shot.narrative_role}
            </p>
          )}

          {/* Timing inputs in edit mode */}
          {isEditing && (
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">Timing</span>
                <input
                  type="number"
                  step={0.5}
                  min={0}
                  value={editDraft?.timing_seconds ?? shot.timing_seconds}
                  onChange={(e) => onEditDraftChange({ ...editDraft, timing_seconds: parseFloat(e.target.value) || 0 })}
                  className="w-20 rounded-md border border-border bg-surface-raised px-2 py-1 font-[family-name:var(--font-mono)] text-xs text-text-primary transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
                />
                <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">s</span>
              </label>
              <label className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">Duration</span>
                <input
                  type="number"
                  step={0.5}
                  min={1}
                  max={4}
                  value={editDraft?.duration_seconds ?? shot.duration_seconds}
                  onChange={(e) => onEditDraftChange({ ...editDraft, duration_seconds: parseFloat(e.target.value) || 1 })}
                  className="w-20 rounded-md border border-border bg-surface-raised px-2 py-1 font-[family-name:var(--font-mono)] text-xs text-text-primary transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
                />
                <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">s</span>
              </label>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={onSaveEdit}
                  className="inline-flex items-center gap-1.5 rounded-md bg-electric px-3 py-1 font-[family-name:var(--font-display)] text-xs font-semibold text-void transition-all hover:shadow-[0_0_16px_rgba(0,240,255,0.3)]"
                >
                  <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2.5 6 5 8.5 9.5 3.5" />
                  </svg>
                  Save
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1 text-xs text-text-muted transition-colors hover:border-border-bright hover:text-text-secondary"
                >
                  Cancel
                </button>
              </>
            ) : (
              <div className={`flex items-center gap-2 ${isRemoved ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                {!isRemoved && (
                  <>
                    <button
                      type="button"
                      onClick={onStartEdit}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] text-text-muted transition-all hover:border-electric/30 hover:text-electric"
                    >
                      <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 2l3 3L4 11H1V8L7 2z" />
                      </svg>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={onReplace}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] text-text-muted transition-all hover:border-electric/30 hover:text-electric"
                    >
                      <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                        <path d="M6 8V3M4 5l2-2 2 2M2 10h8" />
                      </svg>
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={onRemove}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] text-text-muted transition-all hover:border-magenta/30 hover:text-magenta"
                    >
                      <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                        <line x1="3" y1="3" x2="9" y2="9" />
                        <line x1="9" y1="3" x2="3" y2="9" />
                      </svg>
                      Remove
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
