import { CREW } from './career-data.js';

// October 5: a surfaced diver near the boat hails it with a recorded human
// voice; a distant diver whistles. Both fade with distance. Recordings are CC0
// (public/assets/voices/SOURCES.md). Voice pools follow each character's bio;
// characters described as "they" draw from both pools.
export const CALL_RANGE = 35;
export const VOICE_CLIPS = {
  male: [
    'call-hey-far-male-1',
    'call-hey-far-male-2',
    'call-hey-far-male-3',
    'call-heyoh-male-1',
    'call-hey-male-2',
    'call-hey-male-3',
    'call-heeey-long-male-1',
  ],
  female: [
    'call-yoohoo-female-1',
    'call-heyyy-female-1',
    'call-hey-female-2',
    'call-yaah-female-1',
  ],
};
const ALL = [...VOICE_CLIPS.male, ...VOICE_CLIPS.female];

export function diverVoice(diver) {
  return CREW.find((c) => c.id === diver?.crewId)?.voice || 'any';
}
// Small, stable per-diver pitch difference so two divers sharing a pool differ.
export function voiceRate(diver) {
  const id = String(diver?.crewId ?? diver?.id ?? '');
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return 0.94 + (hash % 13) * 0.01;
}
export function surfaceCall(diver, distance, soundRange, previous, random = Math.random) {
  const gain = Math.max(0, 1 - distance / soundRange);
  if (gain <= 0) return null;
  if (distance > CALL_RANGE) return { kind: 'whistle', gain };
  const pool = VOICE_CLIPS[diverVoice(diver)] || ALL,
    choices = pool.length > 1 ? pool.filter((clip) => clip !== previous) : pool;
  return {
    kind: 'voice',
    clip: choices[Math.floor(random() * choices.length)],
    gain,
    rate: voiceRate(diver),
  };
}
