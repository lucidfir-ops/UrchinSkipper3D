// Load the identical Phaser-bundled Matter engine without booting a DOM renderer.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { configureBoatPhysics } from '../src/boat.js';
const require = createRequire(import.meta.url);
configureBoatPhysics(
  require(
    join(dirname(require.resolve('phaser/package.json')), 'src/physics/matter-js/CustomMain.js'),
  ),
);
