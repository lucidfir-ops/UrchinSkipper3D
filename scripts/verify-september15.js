import { chromium, firefox } from '@playwright/test';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { september15Checks } from './september15-checks.js';
import { touchFeedbackChecks } from './touch-feedback-checks.js';
import { careerChecks } from './career-checks.js';
import { voyageChecks } from './voyage-checks.js';
import { trafficChecks } from './traffic-checks.js';
import { performanceChecks } from './performance-checks.js';
const record = 'test-results/september15-browser-acceptance.json',
  bundle = readFileSync('dist/index.html', 'utf8').match(/index-[\w-]+\.js/)?.[0],
  previous =
    process.argv.includes('--resume') && existsSync(record)
      ? JSON.parse(readFileSync(record, 'utf8'))
      : null,
  stages = previous?.bundle === bundle ? previous.stages : [],
  started = previous?.bundle === bundle ? previous.started : new Date().toISOString();
for (const [name, type] of [
  ['chromium', chromium],
  ['firefox', firefox],
]) {
  process.env.URCHIN_TEST_BROWSER = name;
  for (const [stage, run] of [
    ...(name === 'firefox' ? [['september15', september15Checks]] : []),
    ['touch', touchFeedbackChecks],
    ...(name === 'chromium'
      ? [
          ['career', careerChecks],
          ['voyage', voyageChecks],
        ]
      : []),
    ['traffic', trafficChecks],
    ['performance', performanceChecks],
  ]) {
    if (stages.some((s) => s.browser === name && s.stage === stage && s.passed)) continue;
    const browser = await type.launch({
      headless: true,
      ...(name === 'chromium' ? { args: ['--no-sandbox'] } : {}),
    });
    const time = Date.now();
    console.log(`Verifying ${name}: ${stage}`);
    try {
      await run(browser);
      stages.push({ browser: name, stage, passed: true, seconds: (Date.now() - time) / 1000 });
    } finally {
      await browser.close();
    }
    writeFileSync(
      record,
      JSON.stringify(
        {
          started,
          bundle,
          stages,
        },
        null,
        2,
      ),
    );
  }
}
