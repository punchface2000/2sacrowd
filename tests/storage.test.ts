import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings } from '../src/storage';

describe('mergeSettings', () => {
  it('returns defaults for junk', () => {
    for (const junk of [null, undefined, 42, 'x', []]) {
      expect(mergeSettings(junk)).toEqual({ ...DEFAULT_SETTINGS, games: {} });
    }
  });
  it('keeps valid values and drops invalid ones', () => {
    const s = mergeSettings({
      theme: 'dark',
      sound: false,
      games: { 'bee-or-honey': { players: 3, target: 'x', bad: NaN }, broken: 5 },
      extra: 1,
    });
    expect(s.theme).toBe('dark');
    expect(s.sound).toBe(false);
    expect(s.games).toEqual({ 'bee-or-honey': { players: 3 } });
  });
  it('ignores an unknown theme', () => {
    expect(mergeSettings({ theme: 'purple' }).theme).toBe('auto');
  });
});
