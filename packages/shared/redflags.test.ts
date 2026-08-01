import assert from 'node:assert/strict';
import test from 'node:test';
import { detectRedFlags } from './redflags.js';

test('detectRedFlags catches the major emergency and urgent patterns', () => {
  assert.equal(detectRedFlags('I have chest pressure and trouble breathing.').forcedAcuity, 'emergency');
  assert.equal(detectRedFlags('My face is drooping and I have sudden confusion.').forcedAcuity, 'emergency');
  assert.equal(detectRedFlags('I have a high fever while on prednisone.').forcedAcuity, 'urgent');
  assert.equal(detectRedFlags('There is blood in my stool after sudden severe abdominal pain.').forcedAcuity, 'urgent');
  assert.equal(detectRedFlags('I have a new severe headache and vision loss.').forcedAcuity, 'urgent');
  assert.equal(detectRedFlags('I want to die.').forcedAcuity, 'emergency');
});
