// FF7 Visual Theme Constants
// Pure data — no JSX. Imported by FF7-themed components.

// =============================================
// Character-Agent Mapping
// =============================================

export interface FF7Character {
  name: string;
  initials: string;
  color: string;
  battleAction: string;
}

export const CHARACTER_MAP: Record<string, FF7Character> = {
  analyzing: { name: 'Cloud', initials: 'CL', color: '#00e5a0', battleAction: 'Braver' },
  scripting: { name: 'Tifa', initials: 'TF', color: '#ffc933', battleAction: 'Beat Rush' },
  broll_planning: { name: 'Aerith', initials: 'AE', color: '#7aff6e', battleAction: 'Healing Wind' },
  broll_generation: { name: 'Aerith', initials: 'AE', color: '#7aff6e', battleAction: 'Healing Wind' },
  casting: { name: 'Red XIII', initials: 'RX', color: '#ff8c42', battleAction: 'Sled Fang' },
  directing: { name: 'Barret', initials: 'BA', color: '#ff2d55', battleAction: 'Big Shot' },
  voiceover: { name: 'Cait Sith', initials: 'CS', color: '#b388ff', battleAction: 'Dice' },
  editing: { name: 'Limit Break', initials: 'LB', color: '#7aff6e', battleAction: 'Omnislash' },
};

// Resolve a pipeline status to its character key (maps review gates to their preceding agent)
export function getCharacterForStatus(status: string): FF7Character | null {
  if (CHARACTER_MAP[status]) return CHARACTER_MAP[status];

  const reviewToAgent: Record<string, string> = {
    analysis_review: 'analyzing',
    script_review: 'scripting',
    broll_review: 'broll_planning',
    influencer_selection: 'casting',
    casting_review: 'casting',
    asset_review: 'directing',
  };

  const agentKey = reviewToAgent[status];
  return agentKey ? CHARACTER_MAP[agentKey] : null;
}

// =============================================
// Status Effects (Badge Labels)
// =============================================

export interface StatusEffect {
  label: string;
  icon: 'scan' | 'haste' | 'pray' | 'summon' | 'fury' | 'esuna' | 'barrier' | 'wait' | 'recruit' | 'victory' | 'ko' | 'idle' | 'none';
}

export const STATUS_EFFECTS: Record<string, StatusEffect> = {
  created: { label: 'Idle', icon: 'idle' },
  analyzing: { label: 'Scan', icon: 'scan' },
  analysis_review: { label: 'Wait', icon: 'wait' },
  scripting: { label: 'Haste', icon: 'haste' },
  script_review: { label: 'Wait', icon: 'wait' },
  broll_planning: { label: 'Pray', icon: 'pray' },
  broll_review: { label: 'Wait', icon: 'wait' },
  broll_generation: { label: 'Summon', icon: 'summon' },
  influencer_selection: { label: 'Recruit', icon: 'recruit' },
  casting: { label: 'Summon', icon: 'summon' },
  casting_review: { label: 'Wait', icon: 'wait' },
  directing: { label: 'Fury', icon: 'fury' },
  voiceover: { label: 'Esuna', icon: 'esuna' },
  asset_review: { label: 'Wait', icon: 'wait' },
  editing: { label: 'Barrier', icon: 'barrier' },
  completed: { label: 'Victory', icon: 'victory' },
  failed: { label: 'KO', icon: 'ko' },
};

// =============================================
// ATB Stage Config
// =============================================

// Ordered list of pipeline stages for the ATB bar display
export const ATB_STAGES = [
  { key: 'analyzing', label: 'Analyze' },
  { key: 'scripting', label: 'Script' },
  { key: 'broll_planning', label: 'B-Roll' },
  { key: 'casting', label: 'Cast' },
  { key: 'directing', label: 'Direct' },
  { key: 'voiceover', label: 'Voice' },
  { key: 'editing', label: 'Limit' },
] as const;

// Review gates that pause for user input (ATB bar shows "ready")
export const REVIEW_GATES: Record<string, string> = {
  analysis_review: 'analyzing',
  script_review: 'scripting',
  broll_review: 'broll_planning',
  influencer_selection: 'casting',
  casting_review: 'casting',
  asset_review: 'directing',
};

// =============================================
// Gil (Cost) Formatting
// =============================================

export function formatGil(amount: number | string | null | undefined): string {
  if (amount == null) return '0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num <= 0) return '0.00';
  return num.toFixed(2);
}

// =============================================
// Battle Text
// =============================================

export const BATTLE_TEXT = {
  enemyName: 'PROGRESS',
  victory: 'VICTORY',
  ko: 'KO',
  yourTurn: 'YOUR TURN',
  noEncounters: 'No encounters yet.',
  startBattle: 'Start a new battle.',
  noItems: 'No items in inventory.',
  partyNotAssembled: 'Party not assembled.',
  recruit: 'Recruit',
} as const;
