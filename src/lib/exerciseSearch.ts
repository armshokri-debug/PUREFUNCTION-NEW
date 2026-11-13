import { Equipment, Exercise } from '../types';

/**
 * Exercise search and classification.
 *
 * - Every exercise gets a muscle group and an equipment type worked out from its
 *   name and muscles (the imported catalog's body-part and equipment fields are
 *   often wrong, e.g. "Barbell Calf Raise" filed under Upper / Bodyweight).
 * - Search understands abbreviations (db, rdl, abs), plurals, "pushup" vs "push-up"
 *   and small typos, and ranks: exact name > starts with > word match > muscle match.
 */

export const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Hips & Adductors',
  'Core',
  'Full Body',
  'Mobility & Breathing'
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/* ---------------- text helpers ---------------- */

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-_/]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Light stemming: lunges→lunge, raises→raise, presses→press, curls→curl. */
export function stem(w: string): string {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && /(ss|sh|ch|x)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

const tokens = (s: string) => norm(s).split(' ').filter(Boolean).map(stem);

/** Query words that mean something else in the gym. Each maps to alternative words. */
const SYNONYMS: Record<string, string[]> = {
  db: ['dumbbell'],
  bb: ['barbell'],
  kb: ['kettlebell'],
  bw: ['bodyweight'],
  rdl: ['romanian', 'deadlift'],
  sldl: ['stiff', 'deadlift'],
  ohp: ['overhead', 'press'],
  abs: ['core', 'abdominal', 'rectus'],
  ab: ['core', 'abdominal'],
  quad: ['quadriceps'],
  delt: ['deltoid', 'shoulder'],
  lat: ['latissimus'],
  pec: ['pectoral', 'chest'],
  bicep: ['biceps'],
  tricep: ['triceps'],
  hammy: ['hamstring'],
  glute: ['glutes', 'gluteus'],
  trap: ['trapezius', 'traps'],
  pushup: ['push', 'up'],
  situp: ['sit', 'up'],
  pullup: ['pull', 'up'],
  chinup: ['chin', 'up'],
  tgu: ['turkish', 'getup'],
  band: ['banded', 'cable'],
  leg: ['legs'],
  shoulder: ['deltoid'],
  chest: ['pectoral', 'pec'],
  back: ['lat', 'rhomboid'],
  arm: ['biceps', 'triceps']
};

/** Edit distance with transposition, stops early above `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2: number[] = [];
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2.length = 0;
    prev2.push(...prev);
    prev = cur;
  }
  return prev[b.length];
}

/* ---------------- classification ---------------- */

const has = (name: string, re: RegExp) => re.test(name);

/** Ordered: the first rule that matches the exercise name wins. */
const GROUP_RULES: [MuscleGroup, RegExp][] = [
  ['Calves', /\b(calf|calves|soleus|heel raise|tibialis|toe raise|ankle)\b/],
  ['Hamstrings', /\b(leg curl|hamstring|nordic|romanian|rdl|stiff leg|good morning|glute ham)\b/],
  ['Glutes', /\b(glute|hip thrust|bridge|kickback|clamshell|clam|donkey|fire hydrant|monster walk|lateral band walk|abduction)\b/],
  ['Quads', /\b(squat|lunge|leg press|leg extension|step up|stepup|split squat|wall sit|sissy|quad)\b/],
  ['Hips & Adductors', /\b(adductor|groin|hip flexor|psoas|90 90|pigeon|frog|hip airplane|hip car|copenhagen|cossack)\b/],
  ['Core', /\b(plank|crunch|sit up|situp|dead bug|bird dog|pallof|ab wheel|rollout|hollow|leg raise|woodchop|wood chop|russian twist|anti rotation|bear crawl|v up|core|oblique|suitcase|toe touch|tall kneeling lift|chop)\b/],
  ['Biceps', /\b(curl|chin up|chinup)\b/],
  ['Triceps', /\b(tricep|skull ?crusher|pushdown|push down|close grip bench|dip|overhead extension)\b/],
  ['Chest', /\b(bench|chest|push up|pushup|fly|flye|pec deck|svend|floor press|press up)\b/],
  ['Back', /\b(row|pull up|pullup|pulldown|pull down|lat |lat$|face pull|rhomboid|shrug|reverse fly|y raise|t raise|superman|back extension|hyperextension|straight arm|pullover)\b/],
  ['Shoulders', /\b(shoulder|overhead press|military|lateral raise|front raise|rear delt|arnold|scap|cuff|external rotation|internal rotation|halo|landmine press|push press|upright row)\b/],
  ['Hamstrings', /\b(deadlift|hinge|pull through|kettlebell swing|kb swing|swing)\b/],
  ['Full Body', /\b(burpee|clean|snatch|jerk|thruster|carry|turkish|get up|getup|sled|battle rope|jump rope|sprint|farmer|slam|walk|crawl|run|bike|row machine|ergometer)\b/]
];

const MUSCLE_TO_GROUP: [RegExp, MuscleGroup][] = [
  [/calves|soleus|tibialis/, 'Calves'],
  [/hamstring/, 'Hamstrings'],
  [/glute/, 'Glutes'],
  [/quad/, 'Quads'],
  [/adductor|abductor|hip flexor|tfl|psoas/, 'Hips & Adductors'],
  [/core|oblique|abdominis|rectus|transverse|pelvic/, 'Core'],
  [/bicep|brachialis/, 'Biceps'],
  [/tricep/, 'Triceps'],
  [/pec/, 'Chest'],
  [/latissimus|rhomboid|trap|erector|upper back|scapular/, 'Back'],
  [/delt|cuff|rotator/, 'Shoulders'],
  [/diaphragm|nervous|thoracic|joint capsule|foot intrinsic/, 'Mobility & Breathing'],
  [/full body/, 'Full Body']
];

export function muscleGroupOf(ex: Exercise): MuscleGroup {
  const name = norm(ex.name);
  for (const [group, re] of GROUP_RULES) if (has(name, re)) return group;
  for (const m of ex.muscles ?? []) {
    const lm = m.toLowerCase();
    for (const [re, group] of MUSCLE_TO_GROUP) if (re.test(lm)) return group;
  }
  if (ex.pattern === 'Mobility' || ex.pattern === 'Breathing') return 'Mobility & Breathing';
  if (ex.pattern === 'Core' || ex.bodyPart === 'Core') return 'Core';
  if (ex.pattern === 'Push') return 'Chest';
  if (ex.pattern === 'Pull') return 'Back';
  if (ex.pattern === 'Squat' || ex.pattern === 'Lunge / Single Leg') return 'Quads';
  if (ex.pattern === 'Hinge') return 'Hamstrings';
  if (ex.bodyPart === 'Hips') return 'Hips & Adductors';
  if (ex.bodyPart === 'Full Body') return 'Full Body';
  return ex.bodyPart === 'Upper' ? 'Back' : 'Quads';
}

export function equipmentOf(ex: Exercise): Equipment {
  const n = norm(ex.name);
  if (/\b(foam roll|smfr|roller)\b/.test(n)) return 'Foam Roller';
  if (/\bbarbell\b|\bbb\b|\btrap bar\b|\bez bar\b/.test(n)) return 'Barbell';
  if (/\b(dumbbell|db)\b/.test(n)) return 'Dumbbell';
  if (/\b(kettlebell|kettle bell|kb|bottoms up)\b/.test(n)) return 'Kettlebell';
  if (/\b(machine|smith|leg press|hack squat|pec deck|assisted)\b/.test(n)) return 'Machine';
  if (/\b(cable|band|banded|rb|resistance band|tube|pulldown|pushdown|face pull)\b/.test(n)) return 'Cable / Band';
  if (ex.equipment !== 'Other' && ex.equipment !== 'Bodyweight') return ex.equipment;
  if (ex.equipment === 'Other' && /\b(back squat|front squat|overhead squat|deadlift|bench press|clean|snatch|jerk|push press|military press|good morning|hip thrust|zercher|pause squat|rack)\b/.test(n)) return 'Barbell';
  return ex.equipment;
}

/* ---------------- index ---------------- */

interface Entry {
  ex: Exercise;
  name: string; // normalised full name
  nameTokens: string[];
  otherTokens: string[]; // muscles, group, pattern, equipment, plane
  group: MuscleGroup;
  equipment: Equipment;
  hasVideo: boolean;
}

const cache = new WeakMap<Exercise, Entry>();

function entryOf(ex: Exercise): Entry {
  let e = cache.get(ex);
  if (e) return e;
  const group = muscleGroupOf(ex);
  const equipment = equipmentOf(ex);
  e = {
    ex,
    name: norm(ex.name),
    nameTokens: tokens(ex.name),
    otherTokens: tokens([...(ex.muscles ?? []), group, ex.pattern ?? '', equipment, ex.plane ?? '', ex.bodyPart].join(' ')),
    group,
    equipment,
    hasVideo: !!ex.video
  };
  cache.set(ex, e);
  return e;
}

export const groupOf = (ex: Exercise): MuscleGroup => entryOf(ex).group;
export const equipmentTypeOf = (ex: Exercise): Equipment => entryOf(ex).equipment;

/* ---------------- search ---------------- */

export interface SearchFilters {
  /** Muscle group (see MUSCLE_GROUPS). */
  group?: string;
  equipment?: string;
  plane?: string;
  pattern?: string;
  /** Legacy body-part filter, still used by older callers. */
  bodyPart?: string;
  scope?: 'all' | 'pf' | 'mine' | 'favorites' | 'video';
}

export interface SearchOptions {
  favorites?: ReadonlySet<string>;
  sort?: 'best' | 'az';
}

const FUZZY_MIN = 4;

function wordScore(qt: string, nameTokens: string[], otherTokens: string[]): number {
  let best = 0;
  for (const t of nameTokens) {
    if (t === qt) return 100;
    if (qt.length >= 2 && t.startsWith(qt)) best = Math.max(best, 70);
    else if (qt.length >= 3 && t.includes(qt)) best = Math.max(best, 35);
  }
  for (const t of otherTokens) {
    if (t === qt) best = Math.max(best, 40);
    else if (qt.length >= 3 && t.startsWith(qt)) best = Math.max(best, 28);
  }
  if (best >= 70 || qt.length < FUZZY_MIN) return best;
  const max = qt.length >= 8 ? 2 : 1;
  for (const t of nameTokens) {
    if (t.length >= FUZZY_MIN && editDistance(qt, t, max) <= max) best = Math.max(best, 50 - (qt === t ? 0 : 5));
  }
  if (best === 0) {
    for (const t of otherTokens) {
      if (t.length >= FUZZY_MIN && editDistance(qt, t, max) <= max) best = Math.max(best, 18);
    }
  }
  return best;
}

/** Each query word may be satisfied by one of its alternatives (db → dumbbell). */
function expand(q: string): string[][] {
  return norm(q)
    .split(' ')
    .filter(Boolean)
    .slice(0, 6)
    .map((raw) => {
      const base = stem(raw);
      const alts = SYNONYMS[raw] ?? SYNONYMS[base] ?? [];
      return [base, ...alts.map(stem)];
    });
}

function passesFilters(e: Entry, f: SearchFilters, fav?: ReadonlySet<string>): boolean {
  const ex = e.ex;
  if (f.group && f.group !== 'All' && e.group !== f.group) return false;
  if (f.equipment && f.equipment !== 'All' && e.equipment !== f.equipment) return false;
  if (f.plane && f.plane !== 'All' && ex.plane !== f.plane) return false;
  if (f.pattern && f.pattern !== 'All' && ex.pattern !== f.pattern) return false;
  if (f.bodyPart && f.bodyPart !== 'All' && ex.bodyPart !== f.bodyPart) return false;
  switch (f.scope) {
    case 'pf':
      return ex.source === 'pf';
    case 'mine':
      return ex.source === 'coach' || !!ex.isCustom;
    case 'favorites':
      return !!fav?.has(ex.id);
    case 'video':
      return e.hasVideo;
    default:
      return true;
  }
}

/** Shared by the library and the workout builder. Returns the best matches first. */
export function searchExercises(
  list: Exercise[],
  q: string,
  filters: SearchFilters = {},
  options: SearchOptions = {}
): Exercise[] {
  const fav = options.favorites;
  const groups = expand(q);
  const phrase = norm(q);
  const scored: { e: Entry; score: number }[] = [];

  for (const ex of list) {
    const e = entryOf(ex);
    if (!passesFilters(e, filters, fav)) continue;
    let score = 0;
    if (groups.length) {
      let ok = true;
      for (const alts of groups) {
        let s = 0;
        for (const a of alts) s = Math.max(s, wordScore(a, e.nameTokens, e.otherTokens));
        if (s === 0) {
          ok = false;
          break;
        }
        score += s;
      }
      if (!ok) continue;
      if (e.name === phrase) score += 250;
      // the last word is the exercise itself ("Air Squat" is a squat, "Squat Clean" is a clean)
      else if (e.name.endsWith(' ' + phrase)) score += 90;
      else if (e.name.startsWith(phrase + ' ')) score += 65;
      else if (` ${e.name} `.includes(` ${phrase} `)) score += 50;
      else if (e.name.includes(phrase)) score += 35;
      // shorter names are usually the "base" exercise ("Squat" before "Pause Back Squat 3 sec")
      score -= e.nameTokens.length * 3;
    }
    if (ex.source === 'coach' || ex.isCustom) score += 25;
    else if (ex.source === 'pf') score += 15;
    if (e.hasVideo) score += 6;
    if (fav?.has(ex.id)) score += 20;
    scored.push({ e, score });
  }

  if (options.sort === 'az') return scored.sort((a, b) => a.e.name.localeCompare(b.e.name)).map((s) => s.e.ex);
  return scored.sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name)).map((s) => s.e.ex);
}

/** "Did you mean …?" for searches with no results: nearest real word for each unknown word. */
export function suggestQuery(list: Exercise[], q: string): string | null {
  const words = norm(q).split(' ').filter(Boolean);
  if (!words.length) return null;
  const vocab = new Set<string>();
  for (const ex of list) for (const t of entryOf(ex).nameTokens) if (t.length >= 3) vocab.add(t);
  let changed = false;
  const out = words.map((w) => {
    const s = stem(w);
    if (s.length < 3 || vocab.has(s) || SYNONYMS[w] || SYNONYMS[s]) return w;
    for (const v of vocab) if (v.startsWith(s)) return w;
    const max = s.length >= 8 ? 3 : s.length >= 5 ? 2 : 1; // wider than search, so it rescues bigger typos
    let best: string | null = null;
    let bestD = max + 1;
    for (const v of vocab) {
      const d = editDistance(s, v, max);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    if (best) {
      changed = true;
      return best;
    }
    return w;
  });
  return changed ? out.join(' ') : null;
}
