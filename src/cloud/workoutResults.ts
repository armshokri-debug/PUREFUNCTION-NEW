import { Workout } from '../types';

/** Match the existing secure RPC's explicit client-result whitelist. */
export function workoutResults(workout: Workout) {
  return {
    status: workout.status,
    completedAt: workout.completedAt ?? null,
    sessionRpe: workout.sessionRpe ?? null,
    clientFeedback: workout.clientFeedback ?? null,
    blocks: workout.blocks.map((block) => ({
      id: block.id, loggedSets: block.loggedSets.map(({ setNumber, kg, reps, completed }) => ({ setNumber, kg, reps, completed })),
      rpe: block.rpe ?? null, pain: block.pain ?? false, clientNote: block.clientNote ?? null
    }))
  };
}
