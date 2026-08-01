import { describe, expect, it } from 'vitest';
import type { IntakeGuidance } from '@bridgecare/shared';
import { detectRedFlags } from '@bridgecare/shared/redflags';
import { createIntake, decideIntake, MAX_INTAKE_MS, MAX_QUESTIONS, processPatientTurn, type RetrieveIntakeGuidance } from './intake';

const unreachableRetrieve: RetrieveIntakeGuidance = () => { throw new Error('retrieve should not be called once a time/turn cap is already hit'); };

const stubRetrieve = (matches: IntakeGuidance['matches']): RetrieveIntakeGuidance => async () => ({ matches });

describe('adaptive intake circuit breaker', () => {
  it('terminates after six questions', async () => {
    const state = { ...createIntake('synthetic'), turnCount: MAX_QUESTIONS };
    await expect(decideIntake(state, unreachableRetrieve)).resolves.toEqual({ done: true, reason: 'max_turns' });
  });
  it('terminates after ninety seconds', async () => {
    const now = Date.now(); const state = createIntake('synthetic', new Date(now - MAX_INTAKE_MS));
    await expect(decideIntake(state, unreachableRetrieve, now)).resolves.toEqual({ done: true, reason: 'max_time' });
  });
  it('terminates once Moss retrieval has no further unasked pattern', async () => {
    const state = createIntake('synthetic');
    await expect(decideIntake(state, stubRetrieve([]))).resolves.toEqual({ done: true, reason: 'no_further_questions' });
  });
});

describe('local red-flag interrupt', () => {
  it('interrupts before adding an agent question and forces emergency, without calling retrieval', async () => {
    const result = await processPatientTurn(createIntake('synthetic'), 'I have chest pressure and cannot breathe', unreachableRetrieve);
    expect(result.decision).toEqual({ done: true, reason: 'red_flag_interrupt' });
    expect(result.redFlags).toMatchObject({ triggered: true, forcedAcuity: 'emergency' });
    expect(result.state.turns).toEqual([{ role: 'patient', text: 'I have chest pressure and cannot breathe' }]);
  });
  it.each(['My face is drooping and my speech is slurred', 'I want to kill myself', 'I have a high fever while taking biologics'])('detects the safety phrase: %s', (text) => {
    expect(detectRedFlags(text).triggered).toBe(true);
  });
});

describe('Moss-curated follow-up questions', () => {
  it('asks the top unasked Moss match as the next question', async () => {
    const retrieve = stubRetrieve([
      { pattern: 'single_joint_swelling_warmth', acuity: 'contact_provider', followUpQuestion: 'Is one joint newly swollen or warm?', snippet: '...', source: 'ra-swollen-hot-joint' }
    ]);
    const result = await processPatientTurn(createIntake('synthetic'), 'My wrist is swollen and warm', retrieve);
    expect(result.decision).toEqual({ done: false, nextQuestion: 'Is one joint newly swollen or warm?', matchedPattern: 'single_joint_swelling_warmth', reason: expect.stringContaining('single_joint_swelling_warmth') });
    expect(result.state.askedPatterns).toEqual(['single_joint_swelling_warmth']);
    expect(result.state.turns.at(-1)).toEqual({ role: 'agent', text: 'Is one joint newly swollen or warm?' });
  });
  it('does not re-ask a pattern already covered in this conversation', async () => {
    const retrieve = stubRetrieve([
      { pattern: 'single_joint_swelling_warmth', acuity: 'contact_provider', followUpQuestion: 'Is one joint newly swollen or warm?', snippet: '...', source: 'ra-swollen-hot-joint' },
      { pattern: 'possible_infection', acuity: 'urgent', followUpQuestion: 'Any signs of infection?', snippet: '...', source: 'ra-infection-signs' }
    ]);
    const state = { ...createIntake('synthetic'), askedPatterns: ['single_joint_swelling_warmth'] };
    const result = await processPatientTurn(state, 'Still swollen, no fever though', retrieve);
    expect(result.decision).toMatchObject({ done: false, nextQuestion: 'Any signs of infection?', matchedPattern: 'possible_infection' });
  });
});
