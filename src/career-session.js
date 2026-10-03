import { boatSpec } from './boats.js';
import { createTrainingCareer } from './training-replay.js';
import { restTrainingCrew } from './training-tools.js';
import { createTestCareer } from './test-mode.js';
import { createCareer } from './career-state.js';

import { harbourScreen } from './starter-career.js';

import {
  careerWorld,
  loadCareer,
  nextCareerDay,
  encode,
  decode,
  archiveCareer,
  careerArchives,
} from './career-save.js';
import { C } from './config.js';

import { createWorld, currentAt } from './world.js';

import { allAboard } from './day.js';
import { setupPickup } from './debug-scenarios.js';

export function createSessionHooks(scene, context) {
  const { persist, prototype, practice, freshCareer } = context;
  let sandboxReturn = null;
  const hooks = {
    world: () => context.world,
    prototypeOnly: prototype,
    audio: scene.audio,
    graphicsLabel: () => scene.view?.graphicsLabel || 'High',
    cycleGraphics: () => scene.view?.cycleGraphics(),
    boatScreenPose: () => scene.view?.boatScreenPose?.(context.world),
    save: persist,
    archives: () => careerArchives(localStorage, true),
    savePoint: () => {
      if (context.world.career?.sandbox)
        return { ok: false, reason: 'Leave training to save your career.' };
      const result = persist();
      if (!result?.ok) return result;
      try {
        archiveCareer(localStorage);
        return {
          ok: true,
          reason: 'Restore point kept. Use Load saved day / career to return here.',
        };
      } catch (error) {
        return { ok: false, reason: 'Restore point unavailable: ' + error.message };
      }
    },
    startIntro: () => {
      const c = structuredClone(context.world.career);
      if (c.intro?.status !== 'briefing') return;
      c.intro.status = 'active';
      context.world = careerWorld(c);
      persist();
    },
    finishIntro: (skipped) => {
      const old = context.world.career;
      if (!['briefing', 'active'].includes(old.intro?.status)) return;
      const c = createCareer(old.seed, { chooseStarter: true });
      c.difficulty = old.difficulty;
      c.assists = structuredClone(old.assists);
      if (!c.assists.manual?.controlsHelp) c.assists.controlsHelp = false;
      if (old.assistPresets) c.assistPresets = structuredClone(old.assistPresets);
      c.intro = { status: 'complete', skipped: !!skipped };
      context.world = careerWorld(c);
      persist();
    },
    trainingReplay: (options = {}) => {
      if (context.world.career?.sandbox)
        return { ok: false, reason: 'Finish the current practice first.' };
      const saved = persist();
      if (!saved?.ok) return saved;
      sandboxReturn = context.world;
      context.world = careerWorld(createTrainingCareer(sandboxReturn.career, options));
      restTrainingCrew(context.world);
      context.world.boat.fuel = boatSpec(context.world).fuelCapacity;
      scene.playtest.debug = false;
      return { ok: true };
    },
    sandbox: (enter) => {
      if (enter && !context.world.career.sandbox) {
        const saved = persist();
        if (!saved?.ok) return saved;
        sandboxReturn = context.world;
        const career = createTestCareer(context.world.career);
        context.world = careerWorld(career);
      } else if (!enter && sandboxReturn) {
        context.world = sandboxReturn;
        sandboxReturn = null;
        scene.playtest.debug = false;
      } else return { ok: false, reason: 'No Test Mode transition available.' };

      scene.playtest.debug = false;
      return { ok: true };
    },
    importSave: () => {
      const picker = document.createElement('input');
      picker.type = 'file';
      picker.accept = '.json,application/json';
      picker.hidden = true;
      document.body.append(picker);
      picker.oncancel = () => picker.remove();
      picker.onchange = async () => {
        try {
          const data = await picker.files[0].text(),
            result = scene.playtest.hooks.changeCareer(null, data);
          if (result.ok) {
            scene.playtest.open(null);
            if (context.world.day.phase === 'planning')
              scene.playtest.open(harbourScreen(context.world));
          } else scene.playtest.menuNotice = result.reason;
        } catch (error) {
          scene.playtest.menuNotice = 'Backup could not be read: ' + error.message;
        } finally {
          picker.remove();
          scene.playtest.signature = null;
        }
      };
      picker.click();
      return {
        ok: true,
        reason:
          'Choose an exported career JSON file. The current career is archived before import.',
      };
    },
    exportSave: () => {
      if (context.world.career?.sandbox)
        return {
          ok: false,
          reason: 'Test Mode is temporary. Leave Test Mode to export your real career.',
        };
      const data = new Blob([encode(context.world, true)], { type: 'application/json' }),
        url = URL.createObjectURL(data),
        a = document.createElement('a');
      a.href = url;
      a.download = `urchin-career-day-${context.world.career.day}-${Date.now()}.json`;
      a.hidden = true;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return {
        ok: true,
        reason:
          'Career backup exported to browser downloads. Keep a copy with your project backups.',
      };
    },
    changeCareer: (key, data) => {
      if (context.world.career?.sandbox)
        return { ok: false, reason: 'Leave Test Mode before changing real careers.' };
      try {
        if (!persist()?.ok)
          return { ok: false, reason: 'Save unavailable. Current career retained.' };
        const next = data ? decode(data) : key ? decode(localStorage.getItem(key)) : freshCareer();
        archiveCareer(localStorage);
        const previous = context.world;
        context.world = next;
        if (!persist()?.ok) {
          context.world = previous;
          return { ok: false, reason: 'New save unavailable. Current career retained.' };
        }

        return { ok: true };
      } catch (error) {
        return { ok: false, reason: 'Career retained: ' + error.message };
      }
    },
    nextDay: (options) => {
      const next = nextCareerDay(context.world, options);
      if (next) {
        context.world = next;
        persist();
      }
    },
    resumeCareer: () => {
      context.world = loadCareer(localStorage)?.world || freshCareer();
    },
    prototype: () => {
      if (context.world.career?.sandbox) return;
      persist();
      context.world = createWorld({ practice: false });
    },
    reset: (options = { practice }) => {
      context.world = context.world.career
        ? context.world.career.sandbox
          ? careerWorld(structuredClone(context.world.career))
          : loadCareer(localStorage)?.world || context.world
        : createWorld({ ...options, boatId: options.boatId ?? context.world.boat.configuration });

      scene.cameras.main.setZoom(C.camera.initialZoom);
    },
    testDrop: (id) => {
      if (!allAboard(context.world)) return false;
      const patch = context.world.patches.find((p) => p.id === id);
      if (!patch) return false;
      const c = currentAt(context.world, patch.drop.x, patch.drop.y);
      Object.assign(context.world.boat, {
        ...patch.drop,
        heading: 0,
        vx: c.x,
        vy: c.y,
        throttle: 0,
        rudder: 0,
        turn: 0,
        grounded: false,
      });
      context.world.day.practiceTimeStart = context.world.time;
      context.world.day.phase = 'practice';
      context.world.day.assisted = true;
      return true;
    },
    testPickup: (nearCapacity) => {
      scene.playtest.hooks.reset({ practice: true });
      setupPickup(context.world, nearCapacity);
    },
  };
  return hooks;
}
