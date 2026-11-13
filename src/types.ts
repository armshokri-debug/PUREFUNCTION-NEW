export type Role = 'coach' | 'client';

export type CoachTab = 'clients' | 'library' | 'programs' | 'messages';

/** Tabs inside one client's page (coach side). */
export type ClientSection = 'exercises' | 'assessment' | 'notes' | 'goals' | 'progression' | 'nutrition';

export type ClientTab = 'today' | 'progress' | 'messages' | 'refer';

export interface RomMovement {
  id: string;
  name: string;
  left: number;
  right: number;
  normalMax?: number;
}

export interface InBodyData {
  weight: number;
  skeletalMuscleMass: number;
  bodyFatMass: number;
  bodyFatPercent: number;
  visceralFatLevel: number;
  bmr: number;
  inBodyScore: number;
  totalBodyWater?: number;
  segments: {
    leftArm: number;
    rightArm: number;
    trunk: number;
    leftLeg: number;
    rightLeg: number;
  };
  printoutUploaded: boolean;
  printoutFileName?: string;
  /** cloud mode: file path in the private 'inbody-printouts' bucket */
  printoutPath?: string;
  /** demo mode only (no cloud): small preview of the photo kept in this browser */
  printoutPreview?: string;
}

export interface PriTestItem {
  id: string;
  name: string;
  category: 'Pelvis' | 'Ribcage' | 'Shoulder';
  leftResult: string;
  rightResult: string;
  status: 'Not tested' | 'Asymmetric' | 'Neutral' | 'Improved';
  notes: string;
}

export interface GaitPostureItem {
  id: string;
  view: 'Anterior' | 'Lateral' | 'Posterior' | 'Dynamic Gait';
  checkpoint: string;
  finding: string;
  severity: 'Not assessed' | 'Optimal' | 'Mild' | 'Moderate';
}

export interface StrengthTestItem {
  id: string;
  exercise: string;
  loadKg: number;
  reps: number;
}

export interface VideoAssessmentItem {
  id: string;
  title: string;
  angle: string;
  duration: string;
  keyCue: string;
  week0Score: number;
  currentScore: number;
}

/**
 * Where an exercise demo video lives.
 * - youtube / vimeo / drive: coach pastes a share link, we embed the player
 * - url: a direct https link to a video file (.mp4 / .webm / .mov)
 * - file: uploaded in demo mode; `src` is the key in this browser's storage
 * - storage: uploaded to the cloud; `src` is the path in the exercise-videos bucket
 */
export interface ExerciseVideo {
  kind: 'youtube' | 'vimeo' | 'drive' | 'url' | 'file' | 'storage';
  /** cloud bucket for kind 'storage' (default: exercise-videos) */
  bucket?: 'exercise-videos' | 'client-videos';
  src: string;
  fileName?: string;
  sizeBytes?: number;
  durationSec?: number;
  addedAt: string;
}

export type BodyPart = 'Lower' | 'Upper' | 'Core' | 'Hips' | 'Full Body';
export type PlaneOfMotion = 'Sagittal' | 'Frontal' | 'Transverse' | 'Multiplanar';
export type Equipment =
  | 'Bodyweight'
  | 'Dumbbell'
  | 'Kettlebell'
  | 'Barbell'
  | 'Cable / Band'
  | 'Machine'
  | 'Foam Roller'
  | 'Other';
export type MovementPattern =
  | 'Squat'
  | 'Hinge'
  | 'Lunge / Single Leg'
  | 'Push'
  | 'Pull'
  | 'Core'
  | 'Mobility'
  | 'Breathing'
  | 'Locomotion'
  | 'Complex'
  | 'Conditioning';
export type ProgramPhase = 'Reposition' | 'Integrate' | 'Strength' | 'Performance';

export const BODY_PARTS: BodyPart[] = ['Lower', 'Upper', 'Core', 'Hips', 'Full Body'];
export const PLANES: PlaneOfMotion[] = ['Sagittal', 'Frontal', 'Transverse', 'Multiplanar'];
export const EQUIPMENT: Equipment[] = [
  'Bodyweight',
  'Dumbbell',
  'Kettlebell',
  'Barbell',
  'Cable / Band',
  'Machine',
  'Foam Roller',
  'Other'
];
export const PATTERNS: MovementPattern[] = [
  'Squat',
  'Hinge',
  'Lunge / Single Leg',
  'Push',
  'Pull',
  'Core',
  'Mobility',
  'Breathing',
  'Locomotion',
  'Complex',
  'Conditioning'
];
export const PHASES: ProgramPhase[] = ['Reposition', 'Integrate', 'Strength', 'Performance'];

export interface Exercise {
  id: string;
  name: string;
  bodyPart: BodyPart;
  equipment: Equipment;
  plane?: PlaneOfMotion;
  pattern?: MovementPattern;
  muscles?: string[];
  /** Phase this exercise is typically used in (PRI-based progression). */
  phase?: ProgramPhase;
  cues: string[];
  breathingPattern?: string;
  whyItMatters?: string;
  /** Demo video (coach's own, or the catalog link). */
  video?: ExerciseVideo;
  /** 'pf' = Pure Function core set, 'catalog' = imported 1,200+ library, 'coach' = created by the coach */
  source?: 'pf' | 'catalog' | 'coach';
  /** true for exercises the coach created (can be deleted). */
  isCustom?: boolean;
  durationSec?: number;
  illustrationType?: string;
}

/** @deprecated old template model (kept to read old saved data) */
export interface WorkoutSetLog {
  setNumber: number;
  kg: number;
  reps: number;
  completed: boolean;
}

export interface WorkoutExerciseBlock {
  id: string;
  exerciseId: string;
  name: string;
  sets: number;
  targetReps: number;
  loadKg: number;
  restSec: number;
  cue: string;
  lastTimeLoadKg: number;
  lastTimeRepsPerSet: number[]; // e.g., [8, 8, 8] -> all hit if >= targetReps
  loggedSets: WorkoutSetLog[];
}

export interface DayWorkout {
  dayKey: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  dayLabel: string;
  title: string;
  focus: string;
  durationMin: number;
  isRestDay?: boolean;
  blocks: WorkoutExerciseBlock[];
}

/* ---------------------------------------------------------------------------
 * Workouts on real calendar dates (current model)
 * ------------------------------------------------------------------------- */

export type WorkoutStatus = 'planned' | 'completed' | 'missed';

export interface SetLog {
  setNumber: number;
  /** null = not entered yet */
  kg: number | null;
  reps: number | null;
  completed: boolean;
}

export interface WorkoutBlock {
  id: string;
  exerciseId: string;
  name: string;
  /** true = done back-to-back with the previous exercise (A1 / A2) */
  supersetWithPrevious?: boolean;
  sets: number;
  /** "8", "8-10", "30s" (time) or "AMRAP" */
  reps: string;
  /** prescribed load in kg (0 = bodyweight) */
  loadKg: number;
  restSec: number;
  /** coach note shown to the client */
  notes: string;
  // ---- client results ----
  loggedSets: SetLog[];
  /** client effort for this exercise, 6–10 */
  rpe?: number;
  /** client reported pain on this exercise */
  pain?: boolean;
  clientNote?: string;
}

export interface Workout {
  id: string;
  /** local calendar date, YYYY-MM-DD */
  date: string;
  title: string;
  focus: string;
  coachNotes?: string;
  durationMin?: number;
  blocks: WorkoutBlock[];
  status: WorkoutStatus;
  completedAt?: string;
  /** whole-session effort 1–10 */
  sessionRpe?: number;
  clientFeedback?: string;
}

export interface ProgressSeriesPoint {
  week: number;
  squat1RM: number;
  rdl1RM: number;
  bench1RM: number;
  muscleMass: number;
  fatMass: number;
  bodyFatPercent: number;
  hipIrAsymmetry: number;
  shoulderIrAsymmetry: number;
  ankleAsymmetry: number;
  adherenceCompleted: number;
  adherenceTotal: number;
}

export interface MonthlyReportData {
  month: 1 | 2 | 3;
  weeksLabel: string;
  phaseCompleted: string;
  nextPhase: string;
  coachSummary: string;
  nextPhaseFocus: string[];
  metrics: {
    weightKg: { week0: number; current: number; unit: string };
    muscleMassKg: { week0: number; current: number; unit: string };
    bodyFatPct: { week0: number; current: number; unit: string };
    hipIrAsymmetryPct: { week0: number; current: number; unit: string };
    squat1RmKg: { week0: number; current: number; unit: string };
    adherencePct: { week0: number; current: number; unit: string };
  };
}

/** One completed assessment, frozen on the day it was saved (for comparisons). */
export interface AssessmentSnapshot {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** weeks since the first assessment (0 for the first) */
  week: number;
  inBody: InBodyData;
  rom: RomMovement[];
  priTests: PriTestItem[];
  gaitPosture: GaitPostureItem[];
  strengthTests: StrengthTestItem[];
  videos: VideoAssessmentItem[];
  /** coach notes for this assessment, per measure key ("" = general note) */
  notes?: Record<string, string>;
  /** assessment videos (before/after) */
  clips?: AssessmentClip[];
}

/** A filmed movement in an assessment, e.g. overhead squat from the front. */
export interface AssessmentClip {
  id: string;
  movement: string;
  angle: 'Front' | 'Side' | 'Back';
  video: ExerciseVideo;
  note?: string;
}

/** A measurable target for one assessment measure (e.g. hip IR asymmetry under 10%). */
export interface Goal {
  id: string;
  metricKey: string;
  label: string;
  unit: string;
  direction: 'up' | 'down';
  /** value when the goal was set */
  start: number;
  target: number;
  /** YYYY-MM-DD */
  dueDate?: string;
  note?: string;
  createdAt: string;
}

/** A personal best entered by hand (e.g. from before joining). */
export interface ManualRecord {
  id: string;
  /** library exercise when picked from the list */
  exerciseId?: string;
  name: string;
  kg: number;
  reps: number;
  /** YYYY-MM-DD, optional */
  date?: string;
  note?: string;
  addedBy: 'client' | 'coach';
}

export interface ClientEvent {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  text: string;
}

export interface ClientProfile {
  id: string;
  /** Sample record for demonstrations; never a real client. */
  isTestClient?: boolean;
  name: string;
  email: string;
  /** Cloud: morning email on workout days (default on). */
  emailReminders?: boolean;
  avatarId: string;
  /** Profile photo the client uploaded (small data URL). Initials are shown when empty. */
  photoUrl?: string;
  phaseNumber: 1 | 2 | 3 | 4;
  phaseName: 'Reposition' | 'Foundations' | 'Integrate' | 'Strength' | 'Performance';
  currentWeek: number;
  adherenceCompleted: number;
  adherenceTotal: number;
  nextAssessmentDays: number;
  unreadMessages: number;
  inBody: InBodyData;
  rom: RomMovement[];
  priTests: PriTestItem[];
  gaitPosture: GaitPostureItem[];
  strengthTests: StrengthTestItem[];
  videos: VideoAssessmentItem[];
  /** Completed assessments, oldest first. */
  assessments?: AssessmentSnapshot[];
  /** Videos recorded for the assessment in progress (moved into the record on Complete). */
  clips?: AssessmentClip[];
  /** Goals set from assessment measures. */
  goals?: Goal[];
  /** All-time bests entered by hand (logged workouts add records automatically). */
  manualRecords?: ManualRecord[];
  /** Life events shown on progress charts (injury, travel, illness…). */
  events?: ClientEvent[];
  /** Workouts on real dates (sorted by date). */
  workouts?: Workout[];
  /** @deprecated old Mon–Sun template; converted into `workouts` on load. */
  weeklyWorkouts?: DayWorkout[];
  /** Standing posture in degrees, measured by the coach (photo or eye). */
  posture?: PostureAngles;
  /** Spectrum of Patterns (SOP) test values by row id. */
  spectrumTests?: Record<string, { left?: number | string; right?: number | string }>;
  /** Coach notes, newest first. */
  coachNotes?: CoachNote[];
  /** Nutrition targets, meal plan and the client's daily log. */
  nutrition?: NutritionPlan;
  progressHistory: ProgressSeriesPoint[];
  monthlyReports: Record<1 | 2 | 3, MonthlyReportData>;
}

/**
 * Asymmetry formula specified by user:
 * asymmetry % = |L - R| / max(L, R) * 100
 */
export function calculateAsymmetryPercent(left: number, right: number): number {
  const l = Math.max(0, Number(left) || 0);
  const r = Math.max(0, Number(right) || 0);
  const maxVal = Math.max(l, r);
  if (maxVal === 0) return 0;
  return Math.round((Math.abs(l - r) / maxVal) * 100);
}

/**
 * Epley 1RM formula: weight * (1 + reps / 30)
 */
export function calculateEstimated1RM(loadKg: number, reps: number): number {
  if (loadKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(loadKg);
  return Math.round(loadKg * (1 + reps / 30));
}

export interface CoachNote {
  id: string;
  date: string; // ISO yyyy-mm-dd
  text: string;
  /** Shown to the client when true. */
  shared?: boolean;
  pinned?: boolean;
}

export interface NutritionLogDay {
  date: string; // ISO yyyy-mm-dd
  protein?: number; // g
  waterL?: number; // liters
  calories?: number;
  note?: string;
}

export interface NutritionPlan {
  calories?: number;
  protein?: number; // g
  carbs?: number; // g
  fat?: number; // g
  waterL?: number;
  mealPlan?: string;
  coachNote?: string;
  log?: NutritionLogDay[];
}

/** Posture angles in degrees. Signs: + = left side lower / toward right / inward / forward. */
export interface PostureAngles {
  shoulderTilt?: number;
  pelvisTilt?: number;
  headTilt?: number;
  kneeValgusL?: number;
  kneeValgusR?: number;
  headForward?: number;
  roundedShoulders?: number;
  trunkLean?: number;
  /** YYYY-MM-DD */
  measuredOn?: string;
}
