import { describe, expect, it } from 'vitest';
import { createTestClient } from '../testClient';

describe('Test Client fixture', () => {
  it('creates an unjoined, clearly labeled demo with data and no real email', () => {
    const client = createTestClient('2026-11-02');
    expect(client.isTestClient).toBe(true);
    expect(client.name).toContain('TEST CLIENT');
    expect(client.email).toContain('@example.invalid');
    expect(client.workouts?.length).toBeGreaterThan(0);
    expect(client.assessments?.length).toBe(1);
    expect(client.coachNotes?.length).toBe(1);
    expect(client.spectrumTests?.['hip-ir']).toEqual({ left: 28, right: 38 });
  });
});
