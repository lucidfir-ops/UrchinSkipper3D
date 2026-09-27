import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

export async function audioSchedulingChecks(browser, baseline = false) {
  const name = browser.browserType().name();
  const page = await browser.newPage({ viewport: { width: 1224, height: 816 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(`${process.env.URCHIN_TEST_URL || 'http://127.0.0.1:5180/'}?practice=1`);
    await page.waitForFunction(() => window.urchinDebug?.ready);
    await page.locator('#keyboardFallback').click();
    await page.waitForFunction(() => urchinDebug.audio.manager.context.state === 'running');
    await page.evaluate(() => {
      const context = urchinDebug.audio.manager.context;
      window.createdAudioSources = 0;
      window.engineGainWrites = 0;
      const create = context.createBufferSource.bind(context);
      context.createBufferSource = () => {
        window.createdAudioSources++;
        return create();
      };
      for (const sound of Object.values(urchinDebug.audio.engines)) {
        const set = sound.setVolume.bind(sound);
        sound.setVolume = (value) => {
          window.engineGainWrites++;
          return set(value);
        };
      }
      urchinDebug.ui.open('pause');
    });
    await page.waitForTimeout(800);
    const sample = async (label) => {
      await page.evaluate(() => {
        window.createdAudioSources = 0;
        window.engineGainWrites = 0;
      });
      await page.waitForTimeout(3000);
      const result = await page.evaluate(() => ({
        sources: window.createdAudioSources,
        engineGainWrites: window.engineGainWrites,
        context: urchinDebug.audio.manager.context.state,
        gears: Object.fromEntries(
          Object.entries(urchinDebug.audio.engines).map(([k, s]) => [
            k,
            { playing: s.isPlaying, rate: s.rate, volume: s.volume },
          ]),
        ),
      }));
      return { label, ...result };
    };
    const paused = await sample('paused');
    await page.evaluate(() => {
      urchinDebug.ui.open(null);
      urchinDebug.world.boat.throttle = 0;
    });
    await page.waitForTimeout(500);
    const neutral = await sample('neutral');
    const settledNeutral = await sample('settled-neutral');
    const gears = [];
    for (const [label, throttle] of [
      ['forward', 0.8],
      ['reverse', -0.8],
    ]) {
      await page.evaluate((t) => {
        urchinDebug.world.boat.throttle = t;
      }, throttle);
      await page.waitForTimeout(800);
      const sampleGear = await sample(label);
      assert(sampleGear.gears[label].volume > 0.1, `${label} remains audible`);
      assert(sampleGear.gears[label].rate > 1.5, `${label} retains throttle pitch`);
      gears.push(sampleGear);
    }
    const report = { baseline, paused, neutral, settledNeutral, gears, errors };
    writeFileSync(
      `test-results/sep23-audio-${name}${baseline ? '-before' : '-after'}.json`,
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
    if (!baseline) {
      assert(paused.sources <= 12, 'Paused audio should schedule only ordinary loop boundaries');
      assert(neutral.sources <= 20, 'Steady idle should not rebuild audio loops each frame');
      assert(settledNeutral.engineGainWrites <= 2, 'Settled engine gain avoids redundant writes');
      for (const g of gears)
        assert(g.sources <= 95, 'Moving helm limits meaningful pitch changes to 20 Hz');
    }
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}
