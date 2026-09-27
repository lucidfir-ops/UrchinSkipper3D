import assert from 'node:assert/strict';
// Inspect the rendered focus graph, then send real mapped controller buttons.
// Never set ui.index or call activate() from the test driver.
export async function chooseController(page, action, prefix, activate = true) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const route = await page.evaluate(async (prefix) => {
      const { neighbour, menuGeometry, menuDirections } =
          urchinDebug.navigation || (await import('/src/menu-navigation.js')),
        ui = urchinDebug.ui;
      const choices = ui.choices(urchinDebug.world),
        target =
          prefix === 'Forward'
            ? -2
            : prefix === 'Vector chart'
              ? -4
              : prefix === 'Raster chart'
                ? -3
                : choices.findIndex((c) => c.startsWith(prefix));
      if (
        target === -1 ||
        (target === -2 && !ui.panel.querySelector('.screen-forward:not(:disabled)'))
      )
        return { error: 'Choice missing: ' + prefix };
      if (ui.index === target) return { done: true };
      const items = menuGeometry(ui.panel),
        queue = [[ui.index, []]],
        seen = new Set();
      while (queue.length) {
        const [id, path] = queue.shift();
        if (id === target) return { direction: path[0] };
        if (seen.has(id)) continue;
        seen.add(id);
        const directions =
          id < 0 || choices[id]?.startsWith('Back')
            ? ['down', 'up', 'left', 'right']
            : menuDirections(ui.screen, !!urchinDebug.world.career);
        for (const dir of directions) {
          const next = neighbour(items, id, dir);
          if (!seen.has(next)) queue.push([next, [...path, dir]]);
        }
      }
      // Scrolling changes the visible geometry after each press. In a long
      // remapping list, walk up until the header comes into the focus graph.
      if (ui.screen === 'bindings' && choices[target]?.startsWith('Back'))
        return { direction: 'up' };
      return { error: `No controller path from ${ui.index} to ${target} (${prefix})` };
    }, prefix);
    assert(!route.error, route.error);
    if (route.done) {
      if (activate) {
        await action('confirm');
        // Existing career flows now include the explicit purchase step. Navigate
        // off Cancel with the real controller; the S22 suite tests cancellation.
        if (await page.evaluate(() => urchinDebug.ui.screen === 'purchase')) {
          const label = await page.evaluate(() => urchinDebug.ui.choices(urchinDebug.world)[1]);
          await page.waitForFunction(() => !urchinDebug.input.suppressed);
          await chooseController(page, action, label);
        }
      }
      return;
    }
    await action('menu' + route.direction[0].toUpperCase() + route.direction.slice(1));
  }
  throw new Error('Controller navigation did not converge: ' + prefix);
}
