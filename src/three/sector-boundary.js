import * as THREE from 'three';
import { depthAt } from '../terrain.js';

const EDGES = ['north', 'east', 'south', 'west'];
export function boundaryPoint(edge, along, size) {
  return {
    north: { x: along, y: 0 },
    east: { x: size, y: along },
    south: { x: along, y: size },
    west: { x: 0, y: along },
  }[edge];
}

// Charted sector limits are navigational marks, never collision obstacles.
// The exact simulation boundary is the centre of each dashed surface stripe.
export class SectorBoundary {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'Playable sector boundary · amber harbour exit';
    scene.add(this.group);
  }
  rebuild(world) {
    this.group.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this.group.clear();
    const positions = [],
      colours = [],
      size = world.terrain.size,
      harbour = world.day.returnExit?.edge;
    const stripe = (edge, along, width, length, height, colour) => {
      const a = boundaryPoint(edge, along, size),
        horizontal = edge === 'north' || edge === 'south',
        dx = horizontal ? length / 2 : width / 2,
        dz = horizontal ? width / 2 : length / 2,
        vertices = [
          [a.x - dx, height, a.y - dz],
          [a.x + dx, height, a.y - dz],
          [a.x + dx, height, a.y + dz],
          [a.x - dx, height, a.y + dz],
        ];
      for (const index of [0, 2, 1, 0, 3, 2]) {
        positions.push(...vertices[index]);
        colours.push(...colour);
      }
    };
    for (const edge of EDGES) {
      const exit = edge === harbour,
        color = new THREE.Color(exit ? '#ffd677' : '#b9d4dc');
      for (let along = 4; along < size; along += 12) {
        const p = boundaryPoint(edge, along, size);
        if (depthAt(world, p.x, p.y) < 0.2) continue;
        stripe(edge, along, 1.25, 7, 0.46, [0.035, 0.085, 0.09]);
        stripe(edge, along, exit ? 0.65 : 0.48, 6, 0.48, color.toArray());
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    const lines = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }),
    );
    lines.renderOrder = 5;
    this.group.add(lines);
    this.terrain = world.terrain;
    this.edge = harbour;
    this.tideBand = Math.floor(world.environment.seaLevel ?? 0);
  }
  // October 5: the lines alone mark the edges; no on-water warning box. The
  // explicit Return to harbour chip lives in the DOM HUD (return-chip.js).
  update(world, ui, title) {
    if (
      this.terrain !== world.terrain ||
      this.edge !== world.day.returnExit?.edge ||
      this.tideBand !== Math.floor(world.environment.seaLevel ?? 0)
    )
      this.rebuild(world);
    this.group.visible = !title && ['working', 'practice'].includes(world.day.phase);
  }
}
