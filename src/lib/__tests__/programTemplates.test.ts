import { describe, expect, it } from 'vitest';
import { createClientProfile } from '../clients';
import { blankWorkout, upsertWorkout } from '../workouts';
import { applyProgramTemplate, createProgramTemplate } from '../programTemplates';

const client = (name: string) => createClientProfile({ name, email: `${name}@example.invalid`, phaseNumber: 1, phaseName: 'Reposition' });

describe('program templates', () => {
  it('captures one week and applies fresh workouts without overwriting logged results', () => {
    const source = upsertWorkout(client('source'), { ...blankWorkout('2026-11-02'), title: 'Monday plan' });
    const template = createProgramTemplate(source, 'Basics', 'week', '2026-11-03');
    expect(template.days).toHaveLength(1);
    expect(template.days[0].offset).toBe(0);
    const target = upsertWorkout(client('target'), { ...blankWorkout('2026-11-09'), status: 'completed' });
    const skipped = applyProgramTemplate([target], template, [target.id], '2026-11-09');
    expect(skipped.skipped).toBe(1);
    expect(skipped.clients[0].workouts?.[0].status).toBe('completed');
    const next = applyProgramTemplate([client('another')], template, ['not-selected'], '2026-11-09');
    expect(next.copied).toBe(0);
    const recipient = client('recipient');
    const applied = applyProgramTemplate([recipient], template, [recipient.id], '2026-11-09');
    expect(applied.copied).toBe(1);
    expect(applied.clients[0].workouts?.[0].date).toBe('2026-11-09');
    expect(applied.clients[0].workouts?.[0].title).toBe('Monday plan');
    expect(applied.clients[0].workouts?.[0].status).toBe('planned');
  });
  it('rejects empty source periods', () => {
    expect(() => createProgramTemplate(client('empty'), 'No workouts', 'program', '2026-11-02')).toThrow('No workouts');
  });
});
