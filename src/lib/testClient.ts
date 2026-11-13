import { ClientProfile } from '../types';
import { EXERCISES_LIBRARY } from '../data/mockData';
import { createClientProfile } from './clients';
import { addDays, blankWorkout, defaultBlockFor, startOfWeek, todayISO } from './workouts';

/** Obvious, unjoined sample; never uses a real email and can be deleted by the coach. */
export function createTestClient(today: string = todayISO()): ClientProfile {
  const base = createClientProfile({
    name: 'TEST CLIENT — Sample',
    email: `test-${Date.now().toString(36)}@example.invalid`,
    phaseNumber: 1,
    phaseName: 'Reposition'
  });
  const inBody = {
    ...base.inBody, weight: 81.2, skeletalMuscleMass: 35.4, bodyFatMass: 18.3,
    bodyFatPercent: 22.5, visceralFatLevel: 8, bmr: 1660, inBodyScore: 76,
    segments: { leftArm: 3.2, rightArm: 3.3, trunk: 25.1, leftLeg: 8.4, rightLeg: 8.5 }
  };
  const rom = [
    { id: 'test-hip-ir', name: 'Hip internal rotation', left: 28, right: 38, normalMax: 40 },
    { id: 'test-shoulder-ir', name: 'Shoulder internal rotation', left: 70, right: 86, normalMax: 90 },
    { id: 'test-hip-flex', name: 'Hip flexion', left: 119, right: 132, normalMax: 140 }
  ];
  const weekStart = startOfWeek(today);
  const exercises = EXERCISES_LIBRARY.slice(0, 3);
  const workouts = [0, 2, 4].map((offset, index) => {
    const w = blankWorkout(addDays(weekStart, offset));
    return { ...w, title: ['Movement foundation', 'Strength basics', 'Mobility reset'][index],
      focus: 'Technique, controlled tempo and pain-free range',
      blocks: exercises.slice(index === 2 ? 1 : 0, index === 2 ? 3 : 2).map(defaultBlockFor) };
  });
  const assessment = {
    id: `test-assessment-${base.id}`, date: addDays(today, -7), week: 0,
    inBody, rom, priTests: [], gaitPosture: [], strengthTests: [], videos: [],
    notes: { '': 'TEST DATA: initial screening. Review limited left hip rotation and shoulder control.' }
  };
  return {
    ...base, isTestClient: true, currentWeek: 1, nextAssessmentDays: 21,
    inBody, rom, assessments: [assessment],
    spectrumTests: {
      'hip-ir': { left: 28, right: 38 },
      'shoulder-ir': { left: 70, right: 86 },
      'hip-flex': { left: 119, right: 132 }
    },
    posture: { shoulderTilt: 2, pelvisTilt: 3, headForward: 7, measuredOn: addDays(today, -7) },
    coachNotes: [{ id: `note-${base.id}`, date: today, text: 'TEST DATA ONLY: practice breathing, hip control, and progressive loading.', shared: true }],
    workouts,
    progressHistory: [
      { week: 0, squat1RM: 50, rdl1RM: 65, bench1RM: 40, muscleMass: 35.4,
        fatMass: 18.3, bodyFatPercent: 22.5, hipIrAsymmetry: 26, shoulderIrAsymmetry: 19,
        ankleAsymmetry: 12, adherenceCompleted: 2, adherenceTotal: 3 },
      { week: 1, squat1RM: 52, rdl1RM: 67, bench1RM: 42, muscleMass: 35.6,
        fatMass: 18.0, bodyFatPercent: 22.1, hipIrAsymmetry: 24, shoulderIrAsymmetry: 18,
        ankleAsymmetry: 11, adherenceCompleted: 2, adherenceTotal: 3 }
    ]
  };
}
