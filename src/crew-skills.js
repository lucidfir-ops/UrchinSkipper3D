import { CREW } from './career-data.js';
import { seededRandom } from './math.js';

export const SPECIALTY_NAMES = {
  picking: 'Picking speed',
  air: 'Air efficiency',
  awareness: 'Ground awareness',
  current: 'Current holding',
  swimming: 'Swimming speed',
  tank: 'Tank endurance',
  fatigue: 'Fatigue resistance',
};
// 32 visible divers: picking/awareness/fatigue/tank have five majors; the
// remaining three have four. Starter contacts collectively cover all seven.
const majors = ['picking', 'awareness', 'fatigue', 'tank', 'air', 'current', 'swimming'];
const starterMinors = [
  ['air', 'tank'],
  ['current', 'swimming'],
  ['picking', 'air'],
  ['awareness', 'current'],
];
const cache = new Map();
export function crewSkills(id, seed = 0) {
  const key = `${seed}/${id}`;
  if (cache.has(key)) return cache.get(key);
  let index = CREW.findIndex((p) => p.id === id);
  if (index < 0) {
    const team = /^team-(\d+)-diver-(\d)$/.exec(id || '');
    index = team
      ? CREW.length + Number(team[1]) * 2 + Number(team[2])
      : CREW.length + 26 + (id?.endsWith('1') ? 1 : 0);
  }
  const major = majors[index % 7],
    options = majors.filter((s) => s !== major),
    random = seededRandom(seed ^ Math.imul(index + 1, 71253));
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  const result = Object.freeze({
    major,
    minors: Object.freeze([...(starterMinors[index] || options.slice(0, 2))]),
  });
  if (cache.size >= 512) cache.delete(cache.keys().next().value);
  cache.set(key, result);
  return result;
}
