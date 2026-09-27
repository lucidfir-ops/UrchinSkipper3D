// Controller scenarios start through the same funded boat-choice screen as players.
export async function chooseStarter(page, choose, boat = 'Harbour Workhorse') {
  await page.waitForFunction(() => ['intro', 'starter', 'harbour'].includes(urchinDebug.ui.screen));
  if (await page.evaluate(() => urchinDebug.ui.screen === 'intro')) await choose('Skip day 0');
  if (await page.evaluate(() => urchinDebug.ui.screen === 'starter'))
    await choose(`Choose ${boat}`);
  if (await page.evaluate(() => urchinDebug.ui.screen === 'starter'))
    await page.locator('[data-action="buy-selected"]').click();
  if (await page.evaluate(() => urchinDebug.ui.screen === 'purchase'))
    await page.locator('[data-action="confirm-purchase"]').click();
  await page.waitForFunction(() => urchinDebug.ui.screen === 'harbour');
}
