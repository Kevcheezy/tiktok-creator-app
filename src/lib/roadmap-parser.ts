/**
 * Parses docs/ENGINEERING_ROADMAP.md into structured RoadmapTask objects.
 * Pure function — no side effects, no database access.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RoadmapTask {
  id: string;
  title: string;
  tier: string;
  status: 'backlog' | 'in_progress' | 'done';
  priority: string;
  effort: string;
  dependsOn: string[];
  specPath: string | null;
  checkboxes: { total: number; completed: number };
  description: string;
  costImpact: string | null;
  worker: string | null;
  body: string;
}

// ─── FF7 Worker Auto-Assignment ─────────────────────────────────────────────

export const WORKER_KEYWORDS: Record<string, string[]> = {
  cloud: ['api', 'agent', 'worker', 'pipeline', 'queue', 'supabase', 'migration', 'database', 'endpoint', 'route', 'backend'],
  tifa: ['component', 'page', 'ui', 'styling', 'form', 'card', 'detail', 'list', 'storyboard', 'frontend', 'button', 'modal'],
  barret: ['logging', 'versioning', 'deploy', 'redis', 'tls', 'config', 'env', 'cost', 'infrastructure', 'ci', 'cd'],
  aerith: ['spec', 'roadmap', 'design', 'plan', 'ux', 'review', 'acceptance', 'criteria'],
  red_xiii: ['test', 'validation', 'error', 'guard', 'boundary', 'security', 'audit'],
};

export const WORKER_INFO: Record<string, { name: string; color: string; role: string }> = {
  cloud: { name: 'Cloud Strife', color: '#4A90D9', role: 'Backend Lead' },
  tifa: { name: 'Tifa Lockhart', color: '#D94A6B', role: 'Frontend Lead' },
  barret: { name: 'Barret Wallace', color: '#8B6914', role: 'Infrastructure' },
  aerith: { name: 'Aerith Gainsborough', color: '#59B87A', role: 'PM / Design' },
  red_xiii: { name: 'Red XIII', color: '#D97A2A', role: 'QA / Review' },
};

/**
 * Auto-assign a worker based on keyword frequency in the task body.
 * Falls back to 'aerith' if no keywords match.
 */
export function autoAssignWorker(body: string): string {
  const lower = body.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [worker, keywords] of Object.entries(WORKER_KEYWORDS)) {
    scores[worker] = 0;
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'gi');
      const matches = lower.match(regex);
      if (matches) scores[worker] += matches.length;
    }
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return sorted[0][1] > 0 ? sorted[0][0] : 'aerith';
}

// ─── Tier Extraction ────────────────────────────────────────────────────────

const TIER_HEADERS: Record<string, string> = {
  'Tier 0': '0',
  'Tier 1:': '1',
  'Tier 1.5': '1.5',
  'Tier 2': '2',
  'Tier 3': '3',
  'Tier 4': '4',
};

function detectTier(headerLine: number, lines: string[]): string {
  for (let i = headerLine - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.startsWith('### ')) {
      for (const [pattern, tier] of Object.entries(TIER_HEADERS)) {
        if (line.includes(pattern)) return tier;
      }
    }
  }
  return 'unknown';
}

// ─── Status Detection ───────────────────────────────────────────────────────

function detectStatus(header: string, body: string): 'backlog' | 'in_progress' | 'done' {
  // Header patterns: ~~Title~~ DONE, ~~Title~~ FIXED, ~~Title~~ ~~DONE~~
  if (/~~.*~~\s*(DONE|FIXED|~~DONE~~)/i.test(header)) {
    return 'done';
  }

  // Header pattern: 🔧 IN PROGRESS
  if (header.includes('IN PROGRESS')) {
    return 'in_progress';
  }

  // Body pattern: **Status:** Complete
  const statusMatch = body.match(/\*\*Status:\*\*\s*(.+)/i);
  if (statusMatch) {
    const statusText = statusMatch[1].toLowerCase();
    if (statusText.startsWith('complete')) return 'done';
    if (statusText.includes('complete')) return 'in_progress';
  }

  return 'backlog';
}

// ─── Task ID & Title Extraction ─────────────────────────────────────────────

function parseHeader(header: string): { id: string; title: string } | null {
  let text = header.replace(/^####\s*/, '');
  text = text.replace(/~~/g, '');
  text = text.replace(/\s*(DONE|FIXED|IN PROGRESS)\s*/gi, '').trim();
  text = text.replace(/🔧/g, '').trim();
  // Remove trailing notes like "*(completed as R1.3)*"
  text = text.replace(/\*\(.*?\)\*/g, '').trim();

  const match = text.match(/^([RB]\d+\.?\d*\.?\d*)\s*-\s*(.+)$/);
  if (!match) return null;

  return { id: match[1], title: match[2].trim() };
}

// ─── Field Extraction from Body ─────────────────────────────────────────────

function extractField(body: string, field: string): string {
  const regex = new RegExp(`\\*\\*${field}:\\*\\*\\s*(.+)`, 'i');
  const match = body.match(regex);
  return match ? match[1].trim() : '';
}

function extractDependsOn(body: string): string[] {
  const line = extractField(body, 'Depends on');
  if (!line) return [];
  const ids = line.match(/[RB]\d+\.?\d*\.?\d*/g);
  return ids || [];
}

function extractSpecPath(body: string): string | null {
  const spec = extractField(body, 'Spec');
  if (!spec) return null;
  const pathMatch = spec.match(/`([^`]+)`/);
  return pathMatch ? pathMatch[1] : null;
}

function extractCheckboxes(body: string): { total: number; completed: number } {
  const all = body.match(/- \[[ x]\]/g) || [];
  const checked = body.match(/- \[x\]/g) || [];
  return { total: all.length, completed: checked.length };
}

function extractDescription(body: string): string {
  const why = extractField(body, 'Why');
  if (why) {
    const firstSentence = why.split(/\.\s/)[0];
    return firstSentence.endsWith('.') ? firstSentence : firstSentence + '.';
  }
  return '';
}

function extractCostImpact(body: string): string | null {
  const match = body.match(/~?\$[\d.]+(?:-[\d.]+)?(?:\/\w+)?/);
  return match ? match[0] : null;
}

// ─── Main Parser ────────────────────────────────────────────────────────────

export function parseRoadmap(markdown: string): RoadmapTask[] {
  const lines = markdown.split('\n');
  const tasks: RoadmapTask[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (!line.startsWith('#### ')) {
      i++;
      continue;
    }

    const parsed = parseHeader(line);
    if (!parsed) {
      i++;
      continue;
    }

    // Collect body lines until next #### or ### or ---
    const bodyLines: string[] = [];
    let j = i + 1;
    while (j < lines.length && !lines[j].startsWith('#### ') && !lines[j].startsWith('### ') && lines[j] !== '---') {
      bodyLines.push(lines[j]);
      j++;
    }
    const body = bodyLines.join('\n');

    const tier = detectTier(i, lines);
    const status = detectStatus(line, body);
    const priority = extractField(body, 'Priority') || (tier === '0' ? 'P0 - Critical' : '');
    const effort = extractField(body, 'Effort');

    tasks.push({
      id: parsed.id,
      title: parsed.title,
      tier,
      status,
      priority,
      effort,
      dependsOn: extractDependsOn(body),
      specPath: extractSpecPath(body),
      checkboxes: extractCheckboxes(body),
      description: extractDescription(body),
      costImpact: extractCostImpact(body),
      worker: autoAssignWorker(body),
      body,
    });

    i = j;
  }

  return tasks;
}
