import { describe, expect, it } from 'vitest';
import { createIntake, decideIntake, MAX_INTAKE_MS, MAX_QUESTIONS, processPatientTurn } from './intake';

describe('adaptive intake circuit breaker', () => {
  it('terminates after six questions', () => {
    const state = { ...createIntake('synthetic'), turnCount: MAX_QUESTIONS };
    expect(decideIntake(state)).toEqual({ done: true, reason: 'max_turns' });
  });
  it('terminates after ninety seconds', () => {
    const now = Date.now(); const state = createIntake('synthetic', new Date(now - MAX_INTAKE_MS));
    expect(decideIntake(state, now)).toEqual({ done: true, reason: 'max_time' });
  });
});

describe('local red-flag interrupt', () => {
  it('interrupts before adding an agent question and forces emergency', () => {
    const result = processPatientTurn(createIntake('synthetic'), 'I have chest pressure and cannot breathe');
    expect(result.decision).toEqual({ done: true, reason: 'red_flag_interrupt' });
    expect(result.redFlags).toMatchObject({ triggered: true, forcedAcuity: 'emergency' });
    expect(result.state.turns).toEqual([{ role: 'patient', text: 'I have chest pressure and cannot breathe' }]);
  });
});
