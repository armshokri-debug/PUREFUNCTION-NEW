import { ClientProfile, Exercise, WorkoutExerciseBlock, WorkoutSetLog } from '../types';

export const EXERCISES_LIBRARY: Exercise[] = [
  {
    id: 'ex-9090-hip-lift',
    name: '90/90 Hip Lift',
    bodyPart: 'Hips',
    plane: 'Sagittal',
    equipment: 'Foam Roller',
    phase: 'Reposition',
    illustrationType: 'hip-lift',
    durationSec: 45,
    cues: [
      'Place heels flat on wall or low box with hips and knees at 90 degrees.',
      'Gently squeeze the foam roller between knees at 20% effort.',
      'Exhale fully through pursed lips for 5 seconds until lower ribs drop down.',
      'Dig heels down slightly to posteriorly tilt the pelvis (tailbone lifts 1 inch off floor; lower back stays grounded).',
      'Hold pelvic position and inhale quietly through the nose for 4 breath cycles.'
    ],
    breathingPattern: '4s nasal inhale · 6s full sighing exhale · 3s pause',
    whyItMatters:
      'Restores Zone of Apposition (ZOA) of the diaphragm and shifts the pelvis out of an anterior tilt / Left AIC pattern using proximal hamstring co-contraction.'
  },
  {
    id: 'ex-goblet-squat',
    name: 'Goblet Squat',
    bodyPart: 'Lower',
    plane: 'Sagittal',
    equipment: 'Dumbbell',
    phase: 'Integrate',
    illustrationType: 'goblet-squat',
    durationSec: 60,
    cues: [
      'Hold kettlebell or dumbbell vertically at sternum height with elbows tucked slightly forward.',
      'Exhale lightly to stack ribcage directly over pelvis before descending.',
      'Sit straight down between the hips while keeping full foot tripod contact (heel, base of 1st and 5th metatarsal).',
      'Drive vertically through mid-foot without losing ribcage stack at the turnaround.'
    ],
    breathingPattern: 'Inhale into posterior ribcage on descent · Exhale past sticking point',
    whyItMatters:
      'Anterior load acts as a counterbalance, promoting upright torso mechanics, deep hip internal rotation at the bottom, and symmetrical quad/glute loading.'
  },
  {
    id: 'ex-side-lying-clam',
    name: 'Side-lying Clam',
    bodyPart: 'Hips',
    plane: 'Frontal',
    equipment: 'Bodyweight',
    phase: 'Reposition',
    illustrationType: 'clam',
    durationSec: 40,
    cues: [
      'Lie on right side with back flat against a wall and hips flexed to 60 degrees.',
      'Shift top (left) knee slightly forward past the bottom knee to ensure pelvic neutrality.',
      'Lift the top knee while keeping feet together and prevent the pelvis from rolling backward.',
      'Pause 2 seconds at peak glute medius contraction before lowering with control.'
    ],
    breathingPattern: 'Exhale on abduction · Nasal inhale on eccentric return',
    whyItMatters:
      'Isolates posterior glute medius and external rotators in the frontal plane without lumbar spine extension or TFL compensation.'
  },
  {
    id: 'ex-active-hip-rotation',
    name: 'Active Hip Rotation',
    bodyPart: 'Hips',
    plane: 'Sagittal',
    equipment: 'Bodyweight',
    phase: 'Integrate',
    illustrationType: 'hip-rotation',
    durationSec: 50,
    cues: [
      'Start in quadruped (all-fours) with wrists under shoulders and knees under hips.',
      'Push the floor away to protract scapulae and maintain a neutral lumbar spine.',
      'Swivel the ankle outward to drive pure hip internal rotation without hiking the hip.',
      'Control the arc through end-range internal and external rotation for 8 slow reps.'
    ],
    breathingPattern: 'Continuous nasal breathing while maintaining abdominal wall tension',
    whyItMatters:
      'Directly addresses the 17% Left vs Right hip internal rotation asymmetry identified in Week 0 Range of Motion testing.'
  },
  {
    id: 'ex-romanian-deadlift',
    name: 'Romanian Deadlift',
    bodyPart: 'Lower',
    plane: 'Sagittal',
    equipment: 'Barbell',
    phase: 'Strength',
    illustrationType: 'rdl',
    durationSec: 60,
    cues: [
      'Stand tall with soft knees (15-degree bend) and lats engaged to keep bar against thighs.',
      'Translate hips straight back horizontally as if closing a car door with your glutes.',
      'Stop descent as soon as hip backward travel ceases (just below knee cap) — do not round lumbar spine.',
      'Push the floor away with full foot contact to return to tall lockout.'
    ],
    breathingPattern: 'Brace 360° on descent · forceful exhale past mid-shin',
    whyItMatters:
      'Builds eccentric hamstring length and high-force posterior chain capacity while reinforcing symmetrical hip hinge mechanics.'
  },
  {
    id: 'ex-all-fours-belly-lift',
    name: 'All-Fours Belly Lift',
    bodyPart: 'Core',
    plane: 'Sagittal',
    equipment: 'Bodyweight',
    phase: 'Reposition',
    illustrationType: 'belly-lift',
    durationSec: 45,
    cues: [
      'Position hands under shoulders and knees under hips with feet flat against a wall.',
      'Round upper back slightly into a quiet thoracic dome and tuck pelvis gently.',
      'Exhale fully to draw lower abdomen up away from the floor without holding breath.',
      'Maintain position while taking 4 silent nasal inhales into the upper back.'
    ],
    breathingPattern: '5s pursed-lip exhale · 3s pause · 4s posterior ribcage inhale',
    whyItMatters:
      'Inhibits overactive paraspinal extensors and recruits transverse abdominis and internal obliques for ribcage-pelvis integration.'
  },
  {
    id: 'ex-split-squat',
    name: 'Left AIC Split Squat',
    bodyPart: 'Lower',
    plane: 'Frontal',
    equipment: 'Dumbbell',
    phase: 'Strength',
    illustrationType: 'split-squat',
    durationSec: 55,
    cues: [
      'Set up in split stance with 80% of weight rooted through the front heel and mid-foot.',
      'Shift left hip slightly back into the socket so left zipper faces straight ahead.',
      'Drop back knee vertically toward the floor while keeping torso stacked over the pelvis.',
      'Drive straight up through the front inside heel without letting the knee cave medially.'
    ],
    breathingPattern: 'Nasal inhale on 3s lowering · Exhale on concentric drive',
    whyItMatters:
      'Trains single-leg stance stability (AFIR — Acetabular Femoral Internal Rotation) and eliminates bilateral strength compensation.'
  },
  {
    id: 'ex-landmine-press',
    name: 'Single-Arm Landmine Press',
    bodyPart: 'Upper',
    plane: 'Transverse',
    equipment: 'Barbell',
    phase: 'Strength',
    illustrationType: 'landmine-press',
    durationSec: 50,
    cues: [
      'Half-kneeling stance with opposite knee forward; stack ribs over pelvis.',
      'Press along the natural scapular plane (~30° angle) reaching cleanly at the top.',
      'Allow serratus anterior to upwardly rotate the scapula without shrugging the upper trap.',
      'Lower over 3 seconds keeping elbow tracking at 45 degrees from ribs.'
    ],
    breathingPattern: 'Exhale as you reach at top of press · Inhale on eccentric',
    whyItMatters:
      'Develops overhead pressing strength and serratus anterior recruitment while respecting shoulder flexion and internal rotation limits.'
  },
  {
    id: 'ex-wall-squat',
    name: 'Wall Supported Squat Hold',
    bodyPart: 'Lower',
    plane: 'Sagittal',
    equipment: 'Foam Roller',
    phase: 'Reposition',
    illustrationType: 'wall-squat',
    durationSec: 45,
    cues: [
      'Stand with sacrum and mid-back resting lightly against wall, feet 12 inches forward.',
      'Slide down to 60 degrees of knee flexion with foam roller between knees.',
      'Pull left knee slightly behind right knee (1 inch) to bias left hip internal rotation.',
      'Hold for 5 full breath cycles keeping heels heavy.'
    ],
    breathingPattern: 'Slow 4-6 cadence breathing throughout isometric hold',
    whyItMatters:
      'Isometric neuromuscular re-education for pelvis orientation and quadriceps/hamstring co-activation.'
  },
  {
    id: 'ex-pallof-press',
    name: 'Cable Pallof Press',
    bodyPart: 'Core',
    plane: 'Transverse',
    equipment: 'Cable / Band',
    phase: 'Performance',
    illustrationType: 'pallof-press',
    durationSec: 45,
    cues: [
      'Stand in athletic quarter-squat perpendicular to cable column.',
      'Press handle straight out from sternum and resist rotational pull for 3 full seconds.',
      'Keep shoulders and iliac crests squared straight ahead.',
      'Return hands to chest smoothly and repeat.'
    ],
    breathingPattern: 'Exhale during extended hold · Inhale as hands return to sternum',
    whyItMatters:
      'Trains transverse plane anti-rotation stiffness to protect spinal mechanics under asymmetric sport and daily loads.'
  }
];

function createLoggedSets(sets: number, loadKg: number, reps: number, completedCount = 0): WorkoutSetLog[] {
  return Array.from({ length: sets }, (_, idx) => ({
    setNumber: idx + 1,
    kg: loadKg,
    reps,
    completed: idx < completedCount
  }));
}

const alexCarterWorkouts: ClientProfile['weeklyWorkouts'] = [
  {
    dayKey: 'Mon',
    dayLabel: 'Monday',
    title: 'Lower Body Reposition & Squat',
    focus: 'Hips & Sagittal Strength',
    durationMin: 48,
    blocks: [
      {
        id: 'blk-1',
        exerciseId: 'ex-9090-hip-lift',
        name: '90/90 Hip Lift',
        sets: 2,
        targetReps: 5,
        loadKg: 0,
        restSec: 45,
        cue: '5 full breaths per set · feel left hamstring engage before inhaling',
        lastTimeLoadKg: 0,
        lastTimeRepsPerSet: [5, 5],
        loggedSets: createLoggedSets(2, 0, 5, 2)
      },
      {
        id: 'blk-2',
        exerciseId: 'ex-goblet-squat',
        name: 'Goblet Squat',
        sets: 3,
        targetReps: 8,
        loadKg: 35,
        restSec: 90,
        cue: 'Stack ribs over pelvis · 3s eccentric pause at bottom',
        lastTimeLoadKg: 32.5,
        lastTimeRepsPerSet: [8, 8, 8], // All reps hit -> suggests 35 kg (+2.5 kg)
        loggedSets: createLoggedSets(3, 35, 8, 1)
      },
      {
        id: 'blk-3',
        exerciseId: 'ex-romanian-deadlift',
        name: 'Romanian Deadlift',
        sets: 3,
        targetReps: 8,
        loadKg: 82.5,
        restSec: 120,
        cue: 'Push hips straight back · keep lats locked and bar shaving thighs',
        lastTimeLoadKg: 80,
        lastTimeRepsPerSet: [8, 8, 8], // All reps hit -> suggests 82.5 kg (+2.5 kg)
        loggedSets: createLoggedSets(3, 82.5, 8, 0)
      },
      {
        id: 'blk-4',
        exerciseId: 'ex-split-squat',
        name: 'Left AIC Split Squat',
        sets: 3,
        targetReps: 10,
        loadKg: 24,
        restSec: 75,
        cue: 'Left leg forward first · shift left hip slightly back into socket',
        lastTimeLoadKg: 24,
        lastTimeRepsPerSet: [10, 10, 8], // Missed 2 reps on set 3 -> suggests staying at 24 kg
        loggedSets: createLoggedSets(3, 24, 10, 0)
      },
      {
        id: 'blk-5',
        exerciseId: 'ex-active-hip-rotation',
        name: 'Active Hip Rotation',
        sets: 2,
        targetReps: 10,
        loadKg: 0,
        restSec: 45,
        cue: 'Slow 3-second hold at end-range internal rotation on Left hip',
        lastTimeLoadKg: 0,
        lastTimeRepsPerSet: [10, 10],
        loggedSets: createLoggedSets(2, 0, 10, 0)
      }
    ]
  },
  {
    dayKey: 'Tue',
    dayLabel: 'Tuesday',
    title: 'Thoracic Expansion & Upper Push/Pull',
    focus: 'Shoulder Symmetry & Serratus',
    durationMin: 45,
    blocks: [
      {
        id: 'blk-tue-1',
        exerciseId: 'ex-all-fours-belly-lift',
        name: 'All-Fours Belly Lift',
        sets: 2,
        targetReps: 5,
        loadKg: 0,
        restSec: 45,
        cue: 'Round upper back gently and breathe into posterior right ribcage',
        lastTimeLoadKg: 0,
        lastTimeRepsPerSet: [5, 5],
        loggedSets: createLoggedSets(2, 0, 5, 0)
      },
      {
        id: 'blk-tue-2',
        exerciseId: 'ex-landmine-press',
        name: 'Single-Arm Landmine Press',
        sets: 3,
        targetReps: 8,
        loadKg: 30,
        restSec: 90,
        cue: 'Reach protraction at top without upper trap elevation',
        lastTimeLoadKg: 27.5,
        lastTimeRepsPerSet: [8, 8, 8],
        loggedSets: createLoggedSets(3, 30, 8, 0)
      },
      {
        id: 'blk-tue-3',
        exerciseId: 'ex-pallof-press',
        name: 'Cable Pallof Press',
        sets: 3,
        targetReps: 10,
        loadKg: 17.5,
        restSec: 60,
        cue: '3-second isometric pause at full extension',
        lastTimeLoadKg: 15,
        lastTimeRepsPerSet: [10, 10, 10],
        loggedSets: createLoggedSets(3, 17.5, 10, 0)
      }
    ]
  },
  {
    dayKey: 'Wed',
    dayLabel: 'Wednesday',
    title: 'PRI Reset & Frontal Mobility',
    focus: 'Active Recovery & Pelvis Neutrality',
    durationMin: 25,
    blocks: [
      {
        id: 'blk-wed-1',
        exerciseId: 'ex-9090-hip-lift',
        name: '90/90 Hip Lift',
        sets: 3,
        targetReps: 5,
        loadKg: 0,
        restSec: 45,
        cue: 'Focus on long 6-second sighing exhales',
        lastTimeLoadKg: 0,
        lastTimeRepsPerSet: [5, 5, 5],
        loggedSets: createLoggedSets(3, 0, 5, 0)
      },
      {
        id: 'blk-wed-2',
        exerciseId: 'ex-side-lying-clam',
        name: 'Side-lying Clam',
        sets: 3,
        targetReps: 12,
        loadKg: 0,
        restSec: 45,
        cue: 'Keep back and pelvis glued against wall',
        lastTimeLoadKg: 0,
        lastTimeRepsPerSet: [12, 12, 12],
        loggedSets: createLoggedSets(3, 0, 12, 0)
      }
    ]
  },
  {
    dayKey: 'Thu',
    dayLabel: 'Thursday',
    title: 'Posterior Chain & Asymmetry Integration',
    focus: 'Hinge & Single-Leg Force',
    durationMin: 50,
    blocks: [
      {
        id: 'blk-thu-1',
        exerciseId: 'ex-wall-squat',
        name: 'Wall Supported Squat Hold',
        sets: 2,
        targetReps: 5,
        loadKg: 0,
        restSec: 45,
        cue: 'Pull left knee 1 inch back to load left hip internal rotation',
        lastTimeLoadKg: 0,
        lastTimeRepsPerSet: [5, 5],
        loggedSets: createLoggedSets(2, 0, 5, 0)
      },
      {
        id: 'blk-thu-2',
        exerciseId: 'ex-romanian-deadlift',
        name: 'Romanian Deadlift',
        sets: 4,
        targetReps: 6,
        loadKg: 87.5,
        restSec: 120,
        cue: 'Controlled 3-second lowering, maintain mid-foot pressure',
        lastTimeLoadKg: 85,
        lastTimeRepsPerSet: [6, 6, 6, 6],
        loggedSets: createLoggedSets(4, 87.5, 6, 0)
      },
      {
        id: 'blk-thu-3',
        exerciseId: 'ex-split-squat',
        name: 'Left AIC Split Squat',
        sets: 3,
        targetReps: 8,
        loadKg: 26.5,
        restSec: 90,
        cue: 'Vertical torso, drive through front inside heel',
        lastTimeLoadKg: 24,
        lastTimeRepsPerSet: [8, 8, 8],
        loggedSets: createLoggedSets(3, 26.5, 8, 0)
      }
    ]
  },
  {
    dayKey: 'Fri',
    dayLabel: 'Friday',
    title: 'Full Body Integration & Rotational Power',
    focus: 'Multi-Planar Strength',
    durationMin: 45,
    blocks: [
      {
        id: 'blk-fri-1',
        exerciseId: 'ex-goblet-squat',
        name: 'Goblet Squat',
        sets: 3,
        targetReps: 10,
        loadKg: 32.5,
        restSec: 75,
        cue: 'Smooth cadence, full depth without lumbar wink',
        lastTimeLoadKg: 30,
        lastTimeRepsPerSet: [10, 10, 10],
        loggedSets: createLoggedSets(3, 32.5, 10, 0)
      },
      {
        id: 'blk-fri-2',
        exerciseId: 'ex-landmine-press',
        name: 'Single-Arm Landmine Press',
        sets: 3,
        targetReps: 10,
        loadKg: 27.5,
        restSec: 75,
        cue: 'Exhale as you reach at top',
        lastTimeLoadKg: 25,
        lastTimeRepsPerSet: [10, 10, 10],
        loggedSets: createLoggedSets(3, 27.5, 10, 0)
      }
    ]
  },
  {
    dayKey: 'Sat',
    dayLabel: 'Saturday',
    title: 'Zone 2 Aerobic & Hip Mobility Flow',
    focus: 'Aerobic Base & Tissue Length',
    durationMin: 35,
    blocks: [
      {
        id: 'blk-sat-1',
        exerciseId: 'ex-active-hip-rotation',
        name: 'Active Hip Rotation',
        sets: 3,
        targetReps: 10,
        loadKg: 0,
        restSec: 45,
        cue: 'Smooth controlled articular rotations',
        lastTimeLoadKg: 0,
        lastTimeRepsPerSet: [10, 10, 10],
        loggedSets: createLoggedSets(3, 0, 10, 0)
      }
    ]
  },
  {
    dayKey: 'Sun',
    dayLabel: 'Sunday',
    title: 'Rest & Parasympathetic Recovery',
    focus: 'Rest Day',
    durationMin: 0,
    isRestDay: true,
    blocks: []
  }
];

export const INITIAL_CLIENTS: ClientProfile[] = [
  {
    id: 'client-alex-carter',
    name: 'Alex Carter',
    email: 'alex.carter@purefunction.io',
    avatarId: 'alex',
    phaseNumber: 2,
    phaseName: 'Integrate',
    currentWeek: 6,
    adherenceCompleted: 5,
    adherenceTotal: 6,
    nextAssessmentDays: 5,
    unreadMessages: 2,
    inBody: {
      weight: 82.4,
      skeletalMuscleMass: 38.1,
      bodyFatMass: 14.6,
      bodyFatPercent: 17.7,
      visceralFatLevel: 6,
      bmr: 1812,
      inBodyScore: 81,
      segments: {
        leftArm: 3.5,
        rightArm: 3.6,
        trunk: 24.8,
        leftLeg: 8.1,
        rightLeg: 8.2
      },
      printoutUploaded: true,
      printoutFileName: 'InBody270_AlexCarter_Week0.jpg'
    },
    rom: [
      { id: 'rom-1', name: 'Hip internal rotation', left: 34, right: 41, normalMax: 45 }, // 17%
      { id: 'rom-2', name: 'Hip external rotation', left: 40, right: 42, normalMax: 45 }, // 5%
      { id: 'rom-3', name: 'Shoulder flexion', left: 165, right: 150, normalMax: 180 }, // 9%
      { id: 'rom-4', name: 'Shoulder internal rotation', left: 52, right: 61, normalMax: 70 }, // 15%
      { id: 'rom-5', name: 'Ankle dorsiflexion', left: 14, right: 12, normalMax: 20 } // 14%
    ],
    priTests: [
      {
        id: 'pri-1',
        name: 'Adduction Drop Test (ADT)',
        category: 'Pelvis',
        leftResult: 'Positive (Restricted)',
        rightResult: 'Negative (Neutral)',
        status: 'Asymmetric',
        notes: 'Classic Left AIC pattern: left hemipelvis anteriorly tilted and forwardly rotated.'
      },
      {
        id: 'pri-2',
        name: 'Hruska Adduction Lift Test (HALT)',
        category: 'Pelvis',
        leftResult: '2 / 5',
        rightResult: '4 / 5',
        status: 'Asymmetric',
        notes: 'Reduced left acetabular-femoral internal rotation (AFIR) stability.'
      },
      {
        id: 'pri-3',
        name: 'Passive Glenohumeral IR (HGIR)',
        category: 'Shoulder',
        leftResult: '52° (Neutral)',
        rightResult: '61° / Right BC',
        status: 'Asymmetric',
        notes: 'Right brachial chain (BC) counter-rotation reducing right apical expansion.'
      },
      {
        id: 'pri-4',
        name: 'Infrasternal Angle (ISA) & Apical Expansion',
        category: 'Ribcage',
        leftResult: 'Anteriorly Flared',
        rightResult: 'Compressed',
        status: 'Improved',
        notes: 'Responds immediately to 5 breaths of 90/90 Hip Lift with balloon/sigh.'
      }
    ],
    gaitPosture: [
      {
        id: 'gp-1',
        view: 'Anterior',
        checkpoint: 'ASIS & Iliac Crest Height',
        finding: 'Right iliac crest appears slightly higher due to right frontal plane adduction',
        severity: 'Moderate'
      },
      {
        id: 'gp-2',
        view: 'Anterior',
        checkpoint: 'Acromion / Shoulder Level',
        finding: 'Right shoulder sits 1.2 cm lower (Right BC depression)',
        severity: 'Mild'
      },
      {
        id: 'gp-3',
        view: 'Lateral',
        checkpoint: 'Thoracolumbar & Pelvic Stack',
        finding: 'Mild anterior pelvic tilt (14°) with lower ribcage flare',
        severity: 'Moderate'
      },
      {
        id: 'gp-4',
        view: 'Dynamic Gait',
        checkpoint: 'Left Mid-Stance & Right Arm Swing',
        finding: 'Incomplete shift into left hip socket during mid-stance; reduced right arm swing',
        severity: 'Mild'
      }
    ],
    strengthTests: [
      { id: 'str-1', exercise: 'Back / Goblet Squat', loadKg: 70, reps: 5 },
      { id: 'str-2', exercise: 'Romanian Deadlift', loadKg: 82.5, reps: 6 },
      { id: 'str-3', exercise: 'DB Bench Press', loadKg: 60, reps: 6 },
      { id: 'str-4', exercise: 'Split Squat (Left)', loadKg: 24, reps: 8 },
      { id: 'str-5', exercise: 'Single-Arm Row', loadKg: 30, reps: 8 }
    ],
    videos: [
      {
        id: 'vid-1',
        title: 'Overhead Squat Assessment',
        angle: 'Anterior & Sagittal Dual View',
        duration: '0:24',
        keyCue: 'Right lateral hip shift eliminated by 75% after 90/90 Hip Lift warm-up.',
        week0Score: 68,
        currentScore: 91
      },
      {
        id: 'vid-2',
        title: 'Gait Cycle & Mid-Stance Shift',
        angle: 'Posterior Treadmill Slow-Mo (120fps)',
        duration: '0:18',
        keyCue: 'Symmetrical heel contact and clean left acetabular internal rotation.',
        week0Score: 64,
        currentScore: 88
      },
      {
        id: 'vid-3',
        title: 'Single-Leg Balance & Hinge',
        angle: 'Frontal Plane View',
        duration: '0:21',
        keyCue: 'Left knee valgus drift resolved; maintains tripod foot stack.',
        week0Score: 71,
        currentScore: 94
      }
    ],
    weeklyWorkouts: alexCarterWorkouts,
    progressHistory: [
      {
        week: 0,
        squat1RM: 80,
        rdl1RM: 95,
        bench1RM: 72,
        muscleMass: 38.1,
        fatMass: 14.6,
        bodyFatPercent: 17.7,
        hipIrAsymmetry: 17,
        shoulderIrAsymmetry: 15,
        ankleAsymmetry: 14,
        adherenceCompleted: 5,
        adherenceTotal: 6
      },
      {
        week: 2,
        squat1RM: 86,
        rdl1RM: 100,
        bench1RM: 74,
        muscleMass: 38.6,
        fatMass: 14.0,
        bodyFatPercent: 16.9,
        hipIrAsymmetry: 14,
        shoulderIrAsymmetry: 13,
        ankleAsymmetry: 12,
        adherenceCompleted: 6,
        adherenceTotal: 6
      },
      {
        week: 4,
        squat1RM: 92,
        rdl1RM: 105,
        bench1RM: 77,
        muscleMass: 39.2,
        fatMass: 13.2,
        bodyFatPercent: 15.8,
        hipIrAsymmetry: 10,
        shoulderIrAsymmetry: 10,
        ankleAsymmetry: 9,
        adherenceCompleted: 5,
        adherenceTotal: 6
      },
      {
        week: 6,
        squat1RM: 97,
        rdl1RM: 110,
        bench1RM: 79,
        muscleMass: 39.8,
        fatMass: 12.4,
        bodyFatPercent: 14.9,
        hipIrAsymmetry: 8,
        shoulderIrAsymmetry: 8,
        ankleAsymmetry: 7,
        adherenceCompleted: 5,
        adherenceTotal: 6
      },
      {
        week: 8,
        squat1RM: 102,
        rdl1RM: 115,
        bench1RM: 82,
        muscleMass: 40.4,
        fatMass: 11.5,
        bodyFatPercent: 14.0,
        hipIrAsymmetry: 6,
        shoulderIrAsymmetry: 6,
        ankleAsymmetry: 5,
        adherenceCompleted: 6,
        adherenceTotal: 6
      }
    ],
    monthlyReports: {
      1: {
        month: 1,
        weeksLabel: 'Month 1 · Weeks 0–4',
        phaseCompleted: 'Phase 1 · Reposition',
        nextPhase: 'Phase 2 · Integrate',
        coachSummary:
          'Alex completed Phase 1 (Reposition) with 92% session adherence. By prioritizing 90/90 Hip Lifts and Left AIC frontal plane control prior to loading, his Hip Internal Rotation asymmetry dropped from 17% to exactly the 10% clinical threshold, allowing pain-free squat depth progression.',
        nextPhaseFocus: [
          'Transition from supine PRI resets to standing split-stance & unilateral loading (Left AIC Split Squat).',
          'Progress Goblet and Back Squat load by +5 lb weekly when all target reps are achieved.',
          'Reduce Shoulder Internal Rotation asymmetry below 10% via Single-Arm Landmine Presses.'
        ],
        metrics: {
          weightKg: { week0: 82.4, current: 81.9, unit: 'lb' },
          muscleMassKg: { week0: 38.1, current: 39.2, unit: 'lb' },
          bodyFatPct: { week0: 17.7, current: 15.8, unit: '%' },
          hipIrAsymmetryPct: { week0: 17, current: 10, unit: '%' },
          squat1RmKg: { week0: 80, current: 92, unit: 'lb' },
          adherencePct: { week0: 83, current: 92, unit: '%' }
        }
      },
      2: {
        month: 2,
        weeksLabel: 'Month 2 · Weeks 4–8',
        phaseCompleted: 'Phase 2 · Integrate',
        nextPhase: 'Phase 3 · Strength',
        coachSummary:
          'During Month 2 (Integrate), Alex consolidated his pelvic neutrality under progressive bilateral and unilateral loads. Estimated Squat 1RM climbed +22% from Week 0 (176.4 lb → 224.9 lb), while Hip IR asymmetry reached 8% (well below our 10% target line) and Skeletal Muscle Mass increased by +5.1 lb.',
        nextPhaseFocus: [
          'Introduce Phase 3 axial barbell loading (Barbell Back Squat & Trap Bar Deadlift at RPE 7.5–8).',
          'Integrate transverse-plane anti-rotation work (Cable Pallof Press & Rotational Med Ball Throws).',
          'Maintain 2-set 90/90 Hip Lift & All-Fours Belly Lift pre-session primer (4 minutes total).'
        ],
        metrics: {
          weightKg: { week0: 82.4, current: 81.6, unit: 'lb' },
          muscleMassKg: { week0: 38.1, current: 40.4, unit: 'lb' },
          bodyFatPct: { week0: 17.7, current: 14.0, unit: '%' },
          hipIrAsymmetryPct: { week0: 17, current: 8, unit: '%' },
          squat1RmKg: { week0: 80, current: 102, unit: 'lb' },
          adherencePct: { week0: 83, current: 94, unit: '%' }
        }
      },
      3: {
        month: 3,
        weeksLabel: 'Month 3 · Weeks 8–12',
        phaseCompleted: 'Phase 3 · Strength & Performance',
        nextPhase: 'Phase 4 · Performance Maintenance',
        coachSummary:
          'Full 12-week transformation achieved. All five ROM joint asymmetries now sit under 6% (down from 14–17% at baseline), InBody Score improved from 81 to 88, and Squat 1RM reached 246.9 lb (+40% over baseline) with zero lower-back tightness.',
        nextPhaseFocus: [
          'Shift into high-velocity power & reactive agility blocks while retaining 4x/week strength structure.',
          'Quarterly InBody 270 & ROM re-screen scheduled every 6 weeks.',
          'Continue auto-regulated +5 lb progression on primary compound lifts.'
        ],
        metrics: {
          weightKg: { week0: 82.4, current: 81.8, unit: 'lb' },
          muscleMassKg: { week0: 38.1, current: 41.2, unit: 'lb' },
          bodyFatPct: { week0: 17.7, current: 12.9, unit: '%' },
          hipIrAsymmetryPct: { week0: 17, current: 5, unit: '%' },
          squat1RmKg: { week0: 80, current: 112, unit: 'lb' },
          adherencePct: { week0: 83, current: 96, unit: '%' }
        }
      }
    }
  },
  {
    id: 'client-sarah-jenkins',
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@purefunction.io',
    avatarId: 'sarah',
    phaseNumber: 1,
    phaseName: 'Foundations',
    currentWeek: 3,
    adherenceCompleted: 4,
    adherenceTotal: 6,
    nextAssessmentDays: 3,
    unreadMessages: 1,
    inBody: {
      weight: 63.8,
      skeletalMuscleMass: 26.4,
      bodyFatMass: 14.2,
      bodyFatPercent: 22.3,
      visceralFatLevel: 5,
      bmr: 1420,
      inBodyScore: 79,
      segments: {
        leftArm: 2.3,
        rightArm: 2.4,
        trunk: 18.2,
        leftLeg: 6.1,
        rightLeg: 6.2
      },
      printoutUploaded: true,
      printoutFileName: 'InBody270_SarahJenkins_Week0.jpg'
    },
    rom: [
      { id: 'rom-s1', name: 'Hip internal rotation', left: 36, right: 43, normalMax: 45 },
      { id: 'rom-s2', name: 'Hip external rotation', left: 41, right: 43, normalMax: 45 },
      { id: 'rom-s3', name: 'Shoulder flexion', left: 172, right: 162, normalMax: 180 },
      { id: 'rom-s4', name: 'Shoulder internal rotation', left: 58, right: 66, normalMax: 70 },
      { id: 'rom-s5', name: 'Ankle dorsiflexion', left: 15, right: 13, normalMax: 20 }
    ],
    priTests: [
      {
        id: 'pri-s1',
        name: 'Adduction Drop Test (ADT)',
        category: 'Pelvis',
        leftResult: 'Positive (Restricted)',
        rightResult: 'Negative (Neutral)',
        status: 'Asymmetric',
        notes: 'Left pelvic inlet restriction; improves rapidly after wall-supported 90/90 breathing.'
      },
      {
        id: 'pri-s2',
        name: 'Hruska Adduction Lift Test (HALT)',
        category: 'Pelvis',
        leftResult: '3 / 5',
        rightResult: '4 / 5',
        status: 'Improved',
        notes: 'Good glute medius recruitment on right; building left inner hamstring endurance.'
      }
    ],
    gaitPosture: [
      {
        id: 'gp-s1',
        view: 'Lateral',
        checkpoint: 'Ribcage-Pelvis Stack',
        finding: 'Mild bilateral rib flare during overhead reaching',
        severity: 'Mild'
      }
    ],
    strengthTests: [
      { id: 'str-s1', exercise: 'Goblet Squat', loadKg: 28, reps: 8 },
      { id: 'str-s2', exercise: 'Romanian Deadlift', loadKg: 55, reps: 6 },
      { id: 'str-s3', exercise: 'DB Bench Press', loadKg: 32, reps: 8 }
    ],
    videos: [
      {
        id: 'vid-s1',
        title: 'Overhead Squat Assessment',
        angle: 'Anterior & Sagittal View',
        duration: '0:20',
        keyCue: 'Improved ribcage control and symmetrical ankle dorsiflexion.',
        week0Score: 72,
        currentScore: 86
      }
    ],
    weeklyWorkouts: alexCarterWorkouts,
    progressHistory: [
      {
        week: 0,
        squat1RM: 45,
        rdl1RM: 62,
        bench1RM: 38,
        muscleMass: 26.4,
        fatMass: 14.2,
        bodyFatPercent: 22.3,
        hipIrAsymmetry: 16,
        shoulderIrAsymmetry: 12,
        ankleAsymmetry: 13,
        adherenceCompleted: 4,
        adherenceTotal: 6
      },
      {
        week: 2,
        squat1RM: 49,
        rdl1RM: 66,
        bench1RM: 40,
        muscleMass: 26.8,
        fatMass: 13.7,
        bodyFatPercent: 21.4,
        hipIrAsymmetry: 12,
        shoulderIrAsymmetry: 9,
        ankleAsymmetry: 10,
        adherenceCompleted: 5,
        adherenceTotal: 6
      },
      {
        week: 4,
        squat1RM: 54,
        rdl1RM: 72,
        bench1RM: 43,
        muscleMass: 27.3,
        fatMass: 13.1,
        bodyFatPercent: 20.4,
        hipIrAsymmetry: 8,
        shoulderIrAsymmetry: 7,
        ankleAsymmetry: 7,
        adherenceCompleted: 5,
        adherenceTotal: 6
      }
    ],
    monthlyReports: {
      1: {
        month: 1,
        weeksLabel: 'Month 1 · Weeks 0–4',
        phaseCompleted: 'Phase 1 · Foundations',
        nextPhase: 'Phase 2 · Integrate',
        coachSummary:
          'Sarah has built a rock-solid foundation in ribcage-pelvis positioning and reduced her Hip IR asymmetry from 16% to 8%.',
        nextPhaseFocus: [
          'Progress Goblet Squat to Front-Racked Kettlebell Squat.',
          'Increase weekly adherence from 4/6 to 5/6 sessions.'
        ],
        metrics: {
          weightKg: { week0: 63.8, current: 63.4, unit: 'lb' },
          muscleMassKg: { week0: 26.4, current: 27.3, unit: 'lb' },
          bodyFatPct: { week0: 22.3, current: 20.4, unit: '%' },
          hipIrAsymmetryPct: { week0: 16, current: 8, unit: '%' },
          squat1RmKg: { week0: 45, current: 54, unit: 'lb' },
          adherencePct: { week0: 67, current: 83, unit: '%' }
        }
      },
      2: {
        month: 2,
        weeksLabel: 'Month 2 · Weeks 4–8',
        phaseCompleted: 'Phase 2 · Integrate',
        nextPhase: 'Phase 3 · Strength',
        coachSummary: 'Strong progression across all unilateral lower body patterns.',
        nextPhaseFocus: ['Begin barbell hinge progression.'],
        metrics: {
          weightKg: { week0: 63.8, current: 63.1, unit: 'lb' },
          muscleMassKg: { week0: 26.4, current: 28.0, unit: 'lb' },
          bodyFatPct: { week0: 22.3, current: 19.1, unit: '%' },
          hipIrAsymmetryPct: { week0: 16, current: 6, unit: '%' },
          squat1RmKg: { week0: 45, current: 60, unit: 'lb' },
          adherencePct: { week0: 67, current: 90, unit: '%' }
        }
      },
      3: {
        month: 3,
        weeksLabel: 'Month 3 · Weeks 8–12',
        phaseCompleted: 'Phase 3 · Strength',
        nextPhase: 'Phase 4 · Performance',
        coachSummary: 'Outstanding 12-week structural balance and lean mass accrual.',
        nextPhaseFocus: ['Transition to athletic power phase.'],
        metrics: {
          weightKg: { week0: 63.8, current: 63.0, unit: 'lb' },
          muscleMassKg: { week0: 26.4, current: 28.6, unit: 'lb' },
          bodyFatPct: { week0: 22.3, current: 18.2, unit: '%' },
          hipIrAsymmetryPct: { week0: 16, current: 5, unit: '%' },
          squat1RmKg: { week0: 45, current: 66, unit: 'lb' },
          adherencePct: { week0: 67, current: 94, unit: '%' }
        }
      }
    }
  },
  {
    id: 'client-marcus-vance',
    name: 'Marcus Vance',
    email: 'marcus.vance@purefunction.io',
    avatarId: 'marcus',
    phaseNumber: 3,
    phaseName: 'Performance',
    currentWeek: 10,
    adherenceCompleted: 5,
    adherenceTotal: 6,
    nextAssessmentDays: 5,
    unreadMessages: 0,
    inBody: {
      weight: 89.2,
      skeletalMuscleMass: 43.5,
      bodyFatMass: 11.8,
      bodyFatPercent: 13.2,
      visceralFatLevel: 4,
      bmr: 1980,
      inBodyScore: 89,
      segments: {
        leftArm: 4.2,
        rightArm: 4.2,
        trunk: 27.6,
        leftLeg: 9.4,
        rightLeg: 9.5
      },
      printoutUploaded: true,
      printoutFileName: 'InBody270_MarcusVance_Week8.jpg'
    },
    rom: [
      { id: 'rom-m1', name: 'Hip internal rotation', left: 40, right: 42, normalMax: 45 },
      { id: 'rom-m2', name: 'Hip external rotation', left: 43, right: 44, normalMax: 45 },
      { id: 'rom-m3', name: 'Shoulder flexion', left: 175, right: 170, normalMax: 180 },
      { id: 'rom-m4', name: 'Shoulder internal rotation', left: 62, right: 65, normalMax: 70 },
      { id: 'rom-m5', name: 'Ankle dorsiflexion', left: 18, right: 17, normalMax: 20 }
    ],
    priTests: [],
    gaitPosture: [],
    strengthTests: [
      { id: 'str-m1', exercise: 'Back Squat', loadKg: 125, reps: 5 },
      { id: 'str-m2', exercise: 'Romanian Deadlift', loadKg: 140, reps: 5 }
    ],
    videos: [],
    weeklyWorkouts: alexCarterWorkouts,
    progressHistory: [
      {
        week: 0,
        squat1RM: 115,
        rdl1RM: 130,
        bench1RM: 95,
        muscleMass: 41.8,
        fatMass: 14.1,
        bodyFatPercent: 15.8,
        hipIrAsymmetry: 15,
        shoulderIrAsymmetry: 12,
        ankleAsymmetry: 11,
        adherenceCompleted: 5,
        adherenceTotal: 6
      },
      {
        week: 4,
        squat1RM: 128,
        rdl1RM: 142,
        bench1RM: 102,
        muscleMass: 42.7,
        fatMass: 12.9,
        bodyFatPercent: 14.4,
        hipIrAsymmetry: 8,
        shoulderIrAsymmetry: 7,
        ankleAsymmetry: 6,
        adherenceCompleted: 6,
        adherenceTotal: 6
      },
      {
        week: 8,
        squat1RM: 142,
        rdl1RM: 158,
        bench1RM: 108,
        muscleMass: 43.5,
        fatMass: 11.8,
        bodyFatPercent: 13.2,
        hipIrAsymmetry: 5,
        shoulderIrAsymmetry: 5,
        ankleAsymmetry: 6,
        adherenceCompleted: 5,
        adherenceTotal: 6
      }
    ],
    monthlyReports: {
      1: {
        month: 1,
        weeksLabel: 'Month 1 · Weeks 0–4',
        phaseCompleted: 'Phase 1 · Reposition',
        nextPhase: 'Phase 2 · Integrate',
        coachSummary: 'Resolved right hip impingement and restored symmetrical squat tracking.',
        nextPhaseFocus: ['Heavy unilateral split squats & hinge work.'],
        metrics: {
          weightKg: { week0: 89.5, current: 89.3, unit: 'lb' },
          muscleMassKg: { week0: 41.8, current: 42.7, unit: 'lb' },
          bodyFatPct: { week0: 15.8, current: 14.4, unit: '%' },
          hipIrAsymmetryPct: { week0: 15, current: 8, unit: '%' },
          squat1RmKg: { week0: 115, current: 128, unit: 'lb' },
          adherencePct: { week0: 83, current: 95, unit: '%' }
        }
      },
      2: {
        month: 2,
        weeksLabel: 'Month 2 · Weeks 4–8',
        phaseCompleted: 'Phase 2 · Integrate',
        nextPhase: 'Phase 3 · Performance',
        coachSummary: 'All asymmetries under 6%, Squat 1RM reached 313.1 lb.',
        nextPhaseFocus: ['Contrast training and rotational power.'],
        metrics: {
          weightKg: { week0: 89.5, current: 89.2, unit: 'lb' },
          muscleMassKg: { week0: 41.8, current: 43.5, unit: 'lb' },
          bodyFatPct: { week0: 15.8, current: 13.2, unit: '%' },
          hipIrAsymmetryPct: { week0: 15, current: 5, unit: '%' },
          squat1RmKg: { week0: 115, current: 142, unit: 'lb' },
          adherencePct: { week0: 83, current: 96, unit: '%' }
        }
      },
      3: {
        month: 3,
        weeksLabel: 'Month 3 · Weeks 8–12',
        phaseCompleted: 'Phase 3 · Performance',
        nextPhase: 'Phase 4 · Peak',
        coachSummary: 'Peak athletic output achieved across all tests.',
        nextPhaseFocus: ['In-season maintenance block.'],
        metrics: {
          weightKg: { week0: 89.5, current: 89.0, unit: 'lb' },
          muscleMassKg: { week0: 41.8, current: 44.1, unit: 'lb' },
          bodyFatPct: { week0: 15.8, current: 12.4, unit: '%' },
          hipIrAsymmetryPct: { week0: 15, current: 4, unit: '%' },
          squat1RmKg: { week0: 115, current: 150, unit: 'lb' },
          adherencePct: { week0: 83, current: 97, unit: '%' }
        }
      }
    }
  },
  {
    id: 'client-elena-rostova',
    name: 'Elena Rostova',
    email: 'elena.rostova@purefunction.io',
    avatarId: 'elena',
    phaseNumber: 2,
    phaseName: 'Integrate',
    currentWeek: 5,
    adherenceCompleted: 5,
    adherenceTotal: 6,
    nextAssessmentDays: 5,
    unreadMessages: 1,
    inBody: {
      weight: 59.4,
      skeletalMuscleMass: 25.8,
      bodyFatMass: 11.2,
      bodyFatPercent: 18.9,
      visceralFatLevel: 4,
      bmr: 1395,
      inBodyScore: 84,
      segments: {
        leftArm: 2.2,
        rightArm: 2.2,
        trunk: 17.6,
        leftLeg: 5.9,
        rightLeg: 6.0
      },
      printoutUploaded: true,
      printoutFileName: 'InBody270_ElenaRostova_Week4.jpg'
    },
    rom: [
      { id: 'rom-e1', name: 'Hip internal rotation', left: 38, right: 42, normalMax: 45 },
      { id: 'rom-e2', name: 'Hip external rotation', left: 42, right: 44, normalMax: 45 },
      { id: 'rom-e3', name: 'Shoulder flexion', left: 174, right: 168, normalMax: 180 },
      { id: 'rom-e4', name: 'Shoulder internal rotation', left: 56, right: 64, normalMax: 70 },
      { id: 'rom-e5', name: 'Ankle dorsiflexion', left: 16, right: 15, normalMax: 20 }
    ],
    priTests: [],
    gaitPosture: [],
    strengthTests: [],
    videos: [],
    weeklyWorkouts: alexCarterWorkouts,
    progressHistory: [
      {
        week: 0,
        squat1RM: 52,
        rdl1RM: 65,
        bench1RM: 36,
        muscleMass: 24.9,
        fatMass: 12.4,
        bodyFatPercent: 20.8,
        hipIrAsymmetry: 15,
        shoulderIrAsymmetry: 14,
        ankleAsymmetry: 11,
        adherenceCompleted: 5,
        adherenceTotal: 6
      },
      {
        week: 4,
        squat1RM: 60,
        rdl1RM: 74,
        bench1RM: 40,
        muscleMass: 25.8,
        fatMass: 11.2,
        bodyFatPercent: 18.9,
        hipIrAsymmetry: 9,
        shoulderIrAsymmetry: 8,
        ankleAsymmetry: 6,
        adherenceCompleted: 5,
        adherenceTotal: 6
      }
    ],
    monthlyReports: {
      1: {
        month: 1,
        weeksLabel: 'Month 1 · Weeks 0–4',
        phaseCompleted: 'Phase 1 · Reposition',
        nextPhase: 'Phase 2 · Integrate',
        coachSummary: 'Excellent pelvic stability and 15% gain in Squat 1RM.',
        nextPhaseFocus: ['Continue progressive overload on RDL and Split Squat.'],
        metrics: {
          weightKg: { week0: 59.8, current: 59.4, unit: 'lb' },
          muscleMassKg: { week0: 24.9, current: 25.8, unit: 'lb' },
          bodyFatPct: { week0: 20.8, current: 18.9, unit: '%' },
          hipIrAsymmetryPct: { week0: 15, current: 9, unit: '%' },
          squat1RmKg: { week0: 52, current: 60, unit: 'lb' },
          adherencePct: { week0: 83, current: 92, unit: '%' }
        }
      },
      2: {
        month: 2,
        weeksLabel: 'Month 2 · Weeks 4–8',
        phaseCompleted: 'Phase 2 · Integrate',
        nextPhase: 'Phase 3 · Strength',
        coachSummary: 'Consistent strength and lean mass improvements.',
        nextPhaseFocus: ['Axial loading progression.'],
        metrics: {
          weightKg: { week0: 59.8, current: 59.2, unit: 'lb' },
          muscleMassKg: { week0: 24.9, current: 26.4, unit: 'lb' },
          bodyFatPct: { week0: 20.8, current: 17.8, unit: '%' },
          hipIrAsymmetryPct: { week0: 15, current: 6, unit: '%' },
          squat1RmKg: { week0: 52, current: 66, unit: 'lb' },
          adherencePct: { week0: 83, current: 94, unit: '%' }
        }
      },
      3: {
        month: 3,
        weeksLabel: 'Month 3 · Weeks 8–12',
        phaseCompleted: 'Phase 3 · Strength',
        nextPhase: 'Phase 4 · Performance',
        coachSummary: 'Full symmetry restoration and +35% lower-body strength increase.',
        nextPhaseFocus: ['Performance maintenance.'],
        metrics: {
          weightKg: { week0: 59.8, current: 59.1, unit: 'lb' },
          muscleMassKg: { week0: 24.9, current: 27.0, unit: 'lb' },
          bodyFatPct: { week0: 20.8, current: 16.9, unit: '%' },
          hipIrAsymmetryPct: { week0: 15, current: 4, unit: '%' },
          squat1RmKg: { week0: 52, current: 70, unit: 'lb' },
          adherencePct: { week0: 83, current: 96, unit: '%' }
        }
      }
    }
  },
  {
    id: 'client-daniel-kim',
    name: 'Daniel Kim',
    email: 'daniel.kim@purefunction.io',
    avatarId: 'daniel',
    phaseNumber: 3,
    phaseName: 'Performance',
    currentWeek: 9,
    adherenceCompleted: 4,
    adherenceTotal: 6,
    nextAssessmentDays: 5,
    unreadMessages: 1,
    inBody: {
      weight: 76.5,
      skeletalMuscleMass: 36.8,
      bodyFatMass: 10.7,
      bodyFatPercent: 14.0,
      visceralFatLevel: 4,
      bmr: 1755,
      inBodyScore: 86,
      segments: {
        leftArm: 3.4,
        rightArm: 3.4,
        trunk: 23.8,
        leftLeg: 7.9,
        rightLeg: 8.0
      },
      printoutUploaded: true,
      printoutFileName: 'InBody270_DanielKim_Week8.jpg'
    },
    rom: [
      { id: 'rom-d1', name: 'Hip internal rotation', left: 39, right: 42, normalMax: 45 },
      { id: 'rom-d2', name: 'Hip external rotation', left: 43, right: 44, normalMax: 45 },
      { id: 'rom-d3', name: 'Shoulder flexion', left: 172, right: 166, normalMax: 180 },
      { id: 'rom-d4', name: 'Shoulder internal rotation', left: 60, right: 64, normalMax: 70 },
      { id: 'rom-d5', name: 'Ankle dorsiflexion', left: 17, right: 16, normalMax: 20 }
    ],
    priTests: [],
    gaitPosture: [],
    strengthTests: [],
    videos: [],
    weeklyWorkouts: alexCarterWorkouts,
    progressHistory: [
      {
        week: 0,
        squat1RM: 95,
        rdl1RM: 110,
        bench1RM: 80,
        muscleMass: 35.2,
        fatMass: 12.6,
        bodyFatPercent: 16.5,
        hipIrAsymmetry: 14,
        shoulderIrAsymmetry: 13,
        ankleAsymmetry: 10,
        adherenceCompleted: 4,
        adherenceTotal: 6
      },
      {
        week: 4,
        squat1RM: 105,
        rdl1RM: 122,
        bench1RM: 85,
        muscleMass: 36.1,
        fatMass: 11.5,
        bodyFatPercent: 15.1,
        hipIrAsymmetry: 9,
        shoulderIrAsymmetry: 8,
        ankleAsymmetry: 7,
        adherenceCompleted: 5,
        adherenceTotal: 6
      },
      {
        week: 8,
        squat1RM: 114,
        rdl1RM: 132,
        bench1RM: 90,
        muscleMass: 36.8,
        fatMass: 10.7,
        bodyFatPercent: 14.0,
        hipIrAsymmetry: 7,
        shoulderIrAsymmetry: 6,
        ankleAsymmetry: 6,
        adherenceCompleted: 4,
        adherenceTotal: 6
      }
    ],
    monthlyReports: {
      1: {
        month: 1,
        weeksLabel: 'Month 1 · Weeks 0–4',
        phaseCompleted: 'Phase 1 · Reposition',
        nextPhase: 'Phase 2 · Integrate',
        coachSummary: 'Strong improvement in thoracic rotation and overhead pressing mechanics.',
        nextPhaseFocus: ['Maintain 5/6 weekly adherence.'],
        metrics: {
          weightKg: { week0: 76.8, current: 76.6, unit: 'lb' },
          muscleMassKg: { week0: 35.2, current: 36.1, unit: 'lb' },
          bodyFatPct: { week0: 16.5, current: 15.1, unit: '%' },
          hipIrAsymmetryPct: { week0: 14, current: 9, unit: '%' },
          squat1RmKg: { week0: 95, current: 105, unit: 'lb' },
          adherencePct: { week0: 75, current: 86, unit: '%' }
        }
      },
      2: {
        month: 2,
        weeksLabel: 'Month 2 · Weeks 4–8',
        phaseCompleted: 'Phase 2 · Integrate',
        nextPhase: 'Phase 3 · Performance',
        coachSummary: 'Reached 251.3 lb Squat 1RM with symmetrical hip loading.',
        nextPhaseFocus: ['Rotational power and single-leg plyometrics.'],
        metrics: {
          weightKg: { week0: 76.8, current: 76.5, unit: 'lb' },
          muscleMassKg: { week0: 35.2, current: 36.8, unit: 'lb' },
          bodyFatPct: { week0: 16.5, current: 14.0, unit: '%' },
          hipIrAsymmetryPct: { week0: 14, current: 7, unit: '%' },
          squat1RmKg: { week0: 95, current: 114, unit: 'lb' },
          adherencePct: { week0: 75, current: 88, unit: '%' }
        }
      },
      3: {
        month: 3,
        weeksLabel: 'Month 3 · Weeks 8–12',
        phaseCompleted: 'Phase 3 · Performance',
        nextPhase: 'Phase 4 · Peak',
        coachSummary: 'Peak body composition and strength benchmarks hit.',
        nextPhaseFocus: ['Continue progressive strength block.'],
        metrics: {
          weightKg: { week0: 76.8, current: 76.4, unit: 'lb' },
          muscleMassKg: { week0: 35.2, current: 37.4, unit: 'lb' },
          bodyFatPct: { week0: 16.5, current: 13.2, unit: '%' },
          hipIrAsymmetryPct: { week0: 14, current: 5, unit: '%' },
          squat1RmKg: { week0: 95, current: 120, unit: 'lb' },
          adherencePct: { week0: 75, current: 92, unit: '%' }
        }
      }
    }
  },
  {
    id: 'client-olivia-bennett',
    name: 'Olivia Bennett',
    email: 'olivia.bennett@purefunction.io',
    avatarId: 'olivia',
    phaseNumber: 3,
    phaseName: 'Performance',
    currentWeek: 11,
    adherenceCompleted: 5,
    adherenceTotal: 6,
    nextAssessmentDays: 12,
    unreadMessages: 0,
    inBody: {
      weight: 61.2,
      skeletalMuscleMass: 27.9,
      bodyFatMass: 10.4,
      bodyFatPercent: 17.0,
      visceralFatLevel: 3,
      bmr: 1465,
      inBodyScore: 88,
      segments: {
        leftArm: 2.5,
        rightArm: 2.5,
        trunk: 19.1,
        leftLeg: 6.4,
        rightLeg: 6.4
      },
      printoutUploaded: true,
      printoutFileName: 'InBody270_OliviaBennett_Week8.jpg'
    },
    rom: [
      { id: 'rom-o1', name: 'Hip internal rotation', left: 42, right: 44, normalMax: 45 },
      { id: 'rom-o2', name: 'Hip external rotation', left: 44, right: 45, normalMax: 45 },
      { id: 'rom-o3', name: 'Shoulder flexion', left: 178, right: 175, normalMax: 180 },
      { id: 'rom-o4', name: 'Shoulder internal rotation', left: 65, right: 68, normalMax: 70 },
      { id: 'rom-o5', name: 'Ankle dorsiflexion', left: 19, right: 18, normalMax: 20 }
    ],
    priTests: [],
    gaitPosture: [],
    strengthTests: [],
    videos: [],
    weeklyWorkouts: alexCarterWorkouts,
    progressHistory: [
      {
        week: 0,
        squat1RM: 60,
        rdl1RM: 75,
        bench1RM: 42,
        muscleMass: 26.2,
        fatMass: 12.2,
        bodyFatPercent: 19.8,
        hipIrAsymmetry: 14,
        shoulderIrAsymmetry: 11,
        ankleAsymmetry: 9,
        adherenceCompleted: 5,
        adherenceTotal: 6
      },
      {
        week: 4,
        squat1RM: 68,
        rdl1RM: 84,
        bench1RM: 46,
        muscleMass: 27.1,
        fatMass: 11.3,
        bodyFatPercent: 18.4,
        hipIrAsymmetry: 8,
        shoulderIrAsymmetry: 7,
        ankleAsymmetry: 6,
        adherenceCompleted: 6,
        adherenceTotal: 6
      },
      {
        week: 8,
        squat1RM: 76,
        rdl1RM: 94,
        bench1RM: 50,
        muscleMass: 27.9,
        fatMass: 10.4,
        bodyFatPercent: 17.0,
        hipIrAsymmetry: 5,
        shoulderIrAsymmetry: 4,
        ankleAsymmetry: 5,
        adherenceCompleted: 5,
        adherenceTotal: 6
      }
    ],
    monthlyReports: {
      1: {
        month: 1,
        weeksLabel: 'Month 1 · Weeks 0–4',
        phaseCompleted: 'Phase 1 · Reposition',
        nextPhase: 'Phase 2 · Integrate',
        coachSummary: 'Rapid restoration of hip internal rotation and pelvic control.',
        nextPhaseFocus: ['Single-leg RDL and split squat loading.'],
        metrics: {
          weightKg: { week0: 61.6, current: 61.4, unit: 'lb' },
          muscleMassKg: { week0: 26.2, current: 27.1, unit: 'lb' },
          bodyFatPct: { week0: 19.8, current: 18.4, unit: '%' },
          hipIrAsymmetryPct: { week0: 14, current: 8, unit: '%' },
          squat1RmKg: { week0: 60, current: 68, unit: 'lb' },
          adherencePct: { week0: 83, current: 95, unit: '%' }
        }
      },
      2: {
        month: 2,
        weeksLabel: 'Month 2 · Weeks 4–8',
        phaseCompleted: 'Phase 2 · Integrate',
        nextPhase: 'Phase 3 · Performance',
        coachSummary: 'All asymmetries under 5%, +27% Squat 1RM improvement.',
        nextPhaseFocus: ['Performance strength & tempo work.'],
        metrics: {
          weightKg: { week0: 61.6, current: 61.2, unit: 'lb' },
          muscleMassKg: { week0: 26.2, current: 27.9, unit: 'lb' },
          bodyFatPct: { week0: 19.8, current: 17.0, unit: '%' },
          hipIrAsymmetryPct: { week0: 14, current: 5, unit: '%' },
          squat1RmKg: { week0: 60, current: 76, unit: 'lb' },
          adherencePct: { week0: 83, current: 96, unit: '%' }
        }
      },
      3: {
        month: 3,
        weeksLabel: 'Month 3 · Weeks 8–12',
        phaseCompleted: 'Phase 3 · Performance',
        nextPhase: 'Phase 4 · Peak',
        coachSummary: 'Completed 12-week cycle with 88 InBody Score.',
        nextPhaseFocus: ['Long-term athletic development block.'],
        metrics: {
          weightKg: { week0: 61.6, current: 61.0, unit: 'lb' },
          muscleMassKg: { week0: 26.2, current: 28.4, unit: 'lb' },
          bodyFatPct: { week0: 19.8, current: 16.2, unit: '%' },
          hipIrAsymmetryPct: { week0: 14, current: 4, unit: '%' },
          squat1RmKg: { week0: 60, current: 82, unit: 'lb' },
          adherencePct: { week0: 83, current: 97, unit: '%' }
        }
      }
    }
  }
];
