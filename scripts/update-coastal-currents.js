import { readFileSync, writeFileSync } from 'node:fs';
import { RECIPES } from '../world-source/sectors.js';
import { generateCoastalField } from './world/coastal-flow.js';

// Add only hydrodynamics. Never regenerate beds, observations, stock or terrain.
const url = new URL('../src/generated/sectors.json', import.meta.url);
const data = JSON.parse(readFileSync(url, 'utf8'));
for (const sector of data.sectors) {
  sector.terrain.coastalCurrent = generateCoastalField(
    RECIPES.find((r) => r.id === sector.id),
    sector.terrain,
  );
  console.log(`Mapped ${sector.name}`);
}
writeFileSync(url, JSON.stringify(data) + '\n');
