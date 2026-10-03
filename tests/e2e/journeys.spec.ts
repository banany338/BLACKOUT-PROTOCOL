import { test, expect } from '@playwright/test';

test('planner explains the dead end and improves the same target set', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Know your way back.' })).toBeVisible();
  await expect(page.getByText('Your backup depends on the account you just lost.')).toBeVisible();
  await page.getByRole('button', { name: 'Recovery kit', exact: true }).click();
  await expect(
    page.getByText('A recovery route exists. Its prerequisites still matter.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Compare plans' }).first().click();
  await expect(page.getByRole('heading', { name: 'With a recovery kit' })).toBeVisible();
  await page.getByRole('button', { name: 'Recovery map' }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export offline plan' }).click();
  expect((await downloaded).suggestedFilename()).toBe('blackout-recovery-plan.html');
});

test('solo exercise records a complete improved recovery and debrief', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Recovery kit', exact: true }).click();
  await page.getByRole('button', { name: 'Start rehearsal' }).click();
  await expect(page.getByText('Room connected')).toBeVisible();
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click();
  for (const label of [
    'Recover using the independent kit',
    'Rotate work credentials',
    'Revoke active sessions',
    'Review recovery settings',
    'Verify containment is complete',
  ]) {
    await page
      .locator('.action-card')
      .filter({ has: page.getByRole('heading', { name: label, exact: true }) })
      .getByRole('button', { name: 'Choose' })
      .click();
  }
  await page.getByRole('button', { name: 'Next chapter' }).click();
  await page.getByRole('button', { name: 'Next chapter' }).click();
  await page
    .locator('.observation')
    .filter({ has: page.getByRole('heading', { name: 'You have an independent contact' }) })
    .getByRole('button', { name: 'Share observation' })
    .click();
  await page
    .locator('.action-card')
    .filter({ has: page.getByRole('heading', { name: 'Verify through the known contact' }) })
    .getByRole('button', { name: 'Choose' })
    .click();
  await page.getByRole('button', { name: 'End & debrief' }).click();
  await expect(page.getByRole('heading', { name: 'What happened. What changes.' })).toBeVisible();
  await expect(
    page.getByText('Independent verification rejected the impersonated payment request.'),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'What happened. What changes.' })).toBeVisible();
});

test('three browser roles receive only their information, then share context', async ({
  browser,
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start rehearsal' }).click();
  await page.waitForURL('**/room/**');
  const id = new URL(page.url()).pathname.split('/')[2];
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext()));
  const players = await Promise.all(contexts.map((c) => c.newPage()));
  for (const [i, name] of ['Admin', 'Fin', 'Coord'].entries()) {
    await players[i].goto(`/join/${id}`);
    await players[i].getByLabel('Your name').fill(name);
    await players[i].getByRole('button', { name: 'Join exercise' }).click();
    await page
      .getByRole('combobox', { name: `Role for ${name}` })
      .selectOption(['administrator', 'finance', 'coordinator'][i]);
  }
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click();
  await expect(
    players[0].getByRole('heading', { name: 'Your work account no longer recognises you' }),
  ).toBeVisible();
  await expect(
    players[1].getByRole('heading', { name: 'Your work account no longer recognises you' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Next chapter' }).click();
  await page.getByRole('button', { name: 'Next chapter' }).click();
  await players[2]
    .locator('.observation')
    .filter({ has: players[2].getByRole('heading', { name: 'You have an independent contact' }) })
    .getByRole('button', { name: 'Share observation' })
    .click();
  await expect(
    players[1].getByRole('heading', { name: 'You have an independent contact' }),
  ).toBeVisible();
  await players[1].reload();
  await expect(
    players[1].getByRole('heading', { name: 'You have an independent contact' }),
  ).toBeVisible();
  for (const context of contexts) await context.close();
});

test('mobile list has usable controls and no horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'List view', exact: true }).click();
  await expect(page.getByRole('button', { name: /Recovery mailbox Administrator/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
