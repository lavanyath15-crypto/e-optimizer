/**
 * Wake-phrase matching and speech tidying, both pure so they can be checked
 * without a microphone.
 *
 * The split-segment cases below are the ones that mattered in practice: the
 * recogniser rarely hands back "hey optimizer" as a single result, so matching
 * per-result never fired.
 */

import { describe, expect, it } from 'vitest';
import { forSpeech, matchesWakePhrase, normalise } from './useVoice';

describe('normalise', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalise('Hey, Optimizer!')).toBe('hey optimizer');
  });

  it('collapses whitespace', () => {
    expect(normalise('  hey   \n optimizer  ')).toBe('hey optimizer');
  });

  it('survives an empty string', () => {
    expect(normalise('')).toBe('');
    expect(normalise('   ')).toBe('');
  });
});

describe('matchesWakePhrase', () => {
  it('matches the phrase in a single segment', () => {
    expect(matchesWakePhrase(['hey optimizer'])).toBe(true);
  });

  it('matches when the recogniser splits the phrase across segments', () => {
    // This is the case that used to fail: neither segment contains the whole
    // phrase, so checking them individually never matched.
    expect(matchesWakePhrase(['hey', 'optimizer'])).toBe(true);
    expect(matchesWakePhrase(['hey opti', 'mizer'])).toBe(false);
    expect(matchesWakePhrase(['well ok', 'hey', 'optimizer what is steam'])).toBe(true);
  });

  it('matches both spellings and a truncated ending', () => {
    expect(matchesWakePhrase(['hey optimiser'])).toBe(true);
    expect(matchesWakePhrase(['hey optimize'])).toBe(true);
    expect(matchesWakePhrase(['hey optimi'])).toBe(true);
  });

  it('ignores case and punctuation', () => {
    expect(matchesWakePhrase(['HEY, OPTIMIZER!'])).toBe(true);
    expect(matchesWakePhrase(['Hey... Optimizer?'])).toBe(true);
  });

  it('matches mid-sentence', () => {
    expect(matchesWakePhrase(['ok hey optimizer how much steam'])).toBe(true);
  });

  it('does not fire on ordinary speech', () => {
    expect(matchesWakePhrase(['the optimizer is running'])).toBe(false);
    expect(matchesWakePhrase(['hey', 'can you check the column'])).toBe(false);
    expect(matchesWakePhrase(['optimize the reflux ratio'])).toBe(false);
    expect(matchesWakePhrase(['hey there'])).toBe(false);
  });

  it('is false for empty or blank input', () => {
    expect(matchesWakePhrase([])).toBe(false);
    expect(matchesWakePhrase([''])).toBe(false);
    expect(matchesWakePhrase(['   ', ''])).toBe(false);
  });

  it('accepts a custom phrase list', () => {
    expect(matchesWakePhrase(['computer'], ['computer'])).toBe(true);
    expect(matchesWakePhrase(['hey optimizer'], ['computer'])).toBe(false);
  });
});

describe('forSpeech', () => {
  it('expands rate units so the slash is not read out', () => {
    expect(forSpeech('412.8 kg CO2e/kL')).toBe(
      '412.8 kilograms of C O 2 equivalent per kilolitre'
    );
    expect(forSpeech('1289.4 kWh/kL')).toBe('1289.4 kilowatt hours per kilolitre');
    expect(forSpeech('147.4 t/day')).toBe('147.4 tonnes per day');
  });

  it('expands bare units', () => {
    expect(forSpeech('2614 kWh')).toBe('2614 kilowatt hours');
    expect(forSpeech('53.5 MMBtu')).toBe('53.5 million B T U');
    expect(forSpeech('R2 is 0.38')).toBe('R squared is 0.38');
  });

  it('strips markdown punctuation', () => {
    expect(forSpeech('**13,000** kg of steam')).toBe('13,000 kg of steam');
    expect(forSpeech('# Heading   with    spaces')).toBe('Heading with spaces');
  });

  it('leaves ordinary words containing unit letters alone', () => {
    // A bare \bt\b for tonnes would turn "don't" into "dontonnes".
    expect(forSpeech("Don't change reflux yet.")).toBe("Don't change reflux yet.");
  });

  it('returns an empty string for empty input', () => {
    expect(forSpeech('')).toBe('');
    expect(forSpeech('   ')).toBe('');
  });
});
