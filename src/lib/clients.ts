import { ClientProfile, MonthlyReportData } from '../types';
import { WEIGHT_UNIT } from './units';

const zero = (unit: string) => ({ week0: 0, current: 0, unit });

function emptyReport(month: 1 | 2 | 3): MonthlyReportData {
  return {
    month,
    weeksLabel: `Weeks ${(month - 1) * 4}–${month * 4}`,
    phaseCompleted: '',
    nextPhase: '',
    coachSummary: '',
    nextPhaseFocus: [],
    metrics: {
      weightKg: zero(WEIGHT_UNIT),
      muscleMassKg: zero(WEIGHT_UNIT),
      bodyFatPct: zero('%'),
      hipIrAsymmetryPct: zero('%'),
      squat1RmKg: zero(WEIGHT_UNIT),
      adherencePct: zero('%')
    }
  };
}

/** A real new client: no sample numbers, ready for the first assessment. */
export function createClientProfile(input: {
  name: string;
  email: string;
  phaseNumber: ClientProfile['phaseNumber'];
  phaseName: ClientProfile['phaseName'];
}): ClientProfile {
  return {
    id: `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    avatarId: '',
    phaseNumber: input.phaseNumber,
    phaseName: input.phaseName,
    currentWeek: 0,
    adherenceCompleted: 0,
    adherenceTotal: 0,
    nextAssessmentDays: 0,
    unreadMessages: 0,
    inBody: {
      weight: 0,
      skeletalMuscleMass: 0,
      bodyFatMass: 0,
      bodyFatPercent: 0,
      visceralFatLevel: 0,
      bmr: 0,
      inBodyScore: 0,
      segments: { leftArm: 0, rightArm: 0, trunk: 0, leftLeg: 0, rightLeg: 0 },
      printoutUploaded: false
    },
    rom: [
      { id: 'rom-1', name: 'Hip internal rotation', left: 0, right: 0, normalMax: 45 },
      { id: 'rom-2', name: 'Hip external rotation', left: 0, right: 0, normalMax: 45 },
      { id: 'rom-3', name: 'Shoulder flexion', left: 0, right: 0, normalMax: 180 },
      { id: 'rom-4', name: 'Shoulder internal rotation', left: 0, right: 0, normalMax: 70 },
      { id: 'rom-5', name: 'Ankle dorsiflexion', left: 0, right: 0, normalMax: 20 }
    ],
    priTests: [],
    gaitPosture: [],
    strengthTests: [],
    videos: [],
    workouts: [],
    progressHistory: [],
    monthlyReports: { 1: emptyReport(1), 2: emptyReport(2), 3: emptyReport(3) }
  };
}
