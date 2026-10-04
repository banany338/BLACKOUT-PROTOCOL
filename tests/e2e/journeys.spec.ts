import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const pass = 'playwright-only-workspace-2026';
async function openWorkspace(page: Page) {
  await page.goto('/');
  await page.getByLabel('Workspace passphrase', { exact: true }).fill(pass);
  await page.getByLabel('Confirm passphrase', { exact: true }).fill(pass);
  await page.getByRole('button', { name: 'Create my private workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Add first service', exact: true }).waitFor();
}
async function unlockWorkspace(page: Page) {
  await page.getByLabel('Workspace passphrase', { exact: true }).fill(pass);
  await page.getByRole('button', { name: 'Unlock workspace', exact: true }).click();
  await page.getByRole('button', { name: 'My plan', exact: true }).waitFor();
}
async function createPlan(page: Page) {
  await openWorkspace(page);
  await page.getByRole('button', { name: 'Add first service', exact: true }).click();
  await page.getByLabel('Organisation name', { exact: true }).fill('Community Library');
  await page.getByLabel('Responsible person', { exact: true }).fill('Volunteer lead');
  await page.getByLabel('Service name', { exact: true }).fill('Library email');
  await page.getByRole('button', { name: 'Add recovery option', exact: true }).click();
  await page.getByLabel('Recovery option', { exact: true }).fill('Use independent backup');
  await page.getByRole('button', { name: 'Add a phone or backup', exact: true }).click();
  await page.getByLabel('Backup name', { exact: true }).fill('Independent backup');
  await page.getByLabel('We can access this backup now', { exact: true }).check();
  await page.getByRole('button', { name: 'Add backup', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Have you checked it?', exact: true })
    .selectOption('user-reported');
  await page.getByRole('button', { name: 'Save to map', exact: true }).click();
  await page.getByRole('button', { name: 'Try a blackout', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'What if you lose access?', exact: true }),
  ).toBeVisible();
}

test('three-step planning, combined loss, proposed copy, and lock after reload', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.screenshot({ path: info.outputPath('minimal-entry.png'), fullPage: true });
  await createPlan(page);
  await expect(page.getByText('Recovery steps available', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Inspect Independent backup', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('complementary', { name: 'Selected service' })).toContainText(
    'Independent backup',
  );
  await page.getByRole('button', { name: 'Simulate losing this', exact: true }).click();
  await expect(page.getByText('Needs a backup plan', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('blackout-sandbox.png'), fullPage: true });
  await page.getByRole('button', { name: 'Restore in sandbox', exact: true }).click();
  await expect(page.getByText('Recovery steps available', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Independent backup backup', exact: true }).click();
  await expect(page.getByText('Needs a backup plan', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Keep this as a separate proposal', exact: true }).click();
  await expect(page.getByText('Proposed arrangements.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'My plan', exact: true }).click();
  await page.screenshot({ path: info.outputPath('my-plan.png'), fullPage: true });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Unlock your recovery plans.', exact: true }),
  ).toBeVisible();
  await unlockWorkspace(page);
  await expect(
    page.getByRole('heading', { name: 'Community Library — proposed', exact: true }),
  ).toBeVisible();
  await page.getByText('Community Library — proposed · proposed plan', { exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Active plan' }).locator('option')).toHaveCount(
    2,
  );
});

test('downloads readable and encrypted copies, restores, and works offline', async ({
  page,
  context,
}, info) => {
  await createPlan(page);
  await page.getByRole('button', { name: 'Save a readable plan', exact: true }).click();
  await expect(
    page
      .frameLocator('iframe[title="Readable recovery plan"]')
      .getByRole('heading', { name: 'Community Library', exact: true }),
  ).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download HTML plan', exact: true }).click();
  const report = await downloading;
  await report.saveAs(info.outputPath('recovery-plan.html'));
  const html = await readFile(info.outputPath('recovery-plan.html'), 'utf8');
  expect(html).toContain('Use independent backup');
  expect(html).not.toContain('<script');
  const printed = await context.newPage();
  await context.setOffline(true);
  await printed.setContent(html);
  await expect(
    printed.getByRole('heading', { name: 'Community Library', exact: true }),
  ).toBeVisible();
  const pdf = await printed.pdf({
    path: info.outputPath('recovery-plan.pdf'),
    format: 'A4',
    printBackground: true,
  });
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  await printed.close();
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Close saved copy', exact: true }).click();
  await page.getByRole('button', { name: 'Save & restore', exact: true }).click();
  await page.getByRole('button', { name: 'Download encrypted backup', exact: true }).click();
  const backupDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup file', exact: true }).click();
  const backup = await backupDownload;
  const file = info.outputPath('workspace.blackout');
  await backup.saveAs(file);
  expect(await readFile(file, 'utf8')).not.toContain('Community Library');
  await page.getByRole('button', { name: 'Close saved copy', exact: true }).click();
  await page.getByLabel('Encrypted backup', { exact: true }).setInputFiles(file);
  await page.getByLabel('Backup passphrase', { exact: true }).fill(pass);
  await page.getByRole('button', { name: 'Restore as additional plans', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Backup plans added');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await unlockWorkspace(page);
  await expect(
    page.getByRole('heading', { name: 'Community Library (restored)', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Workspace navigation' })
    .getByRole('button', { name: 'Check a problem', exact: true })
    .click();
  await page.getByRole('button', { name: 'Save a readable plan', exact: true }).click();
  await expect(
    page
      .frameLocator('iframe[title="Readable recovery plan"]')
      .getByRole('heading', { name: 'Community Library (restored)', exact: true }),
  ).toBeVisible();
});

test('imports recovery contacts through the file picker with uncertain access', async ({
  page,
}) => {
  await openWorkspace(page);
  await page.getByText('Already have a Google administrator export?', { exact: true }).click();
  await page.getByLabel('Import Google contacts', { exact: true }).setInputFiles({
    name: 'directory.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        users: [
          {
            primaryEmail: 'admin@example.org',
            recoveryEmail: 'backup@example.org',
            password: 'DO-NOT-IMPORT',
          },
          { primaryEmail: 'backup@example.org', recoveryEmail: 'admin@example.org' },
        ],
      }),
    ),
  });
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Organisation name', { exact: true }).fill('Imported team');
  await page.getByRole('button', { name: '04 Important work', exact: true }).click();
  await page.getByRole('button', { name: 'Save and check a problem', exact: true }).click();
  await expect(
    page.getByText('These accounts need each other to recover.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('DO-NOT-IMPORT')).toHaveCount(0);
});

test('a stale editing tab cannot overwrite a saved action', async ({ page, context }) => {
  await createPlan(page);
  await page.getByRole('button', { name: 'Next steps', exact: true }).click();
  await page.getByRole('button', { name: 'Add action', exact: true }).click();
  await page.getByLabel('Action', { exact: true }).fill('Prepare an independent copy');
  await page.getByRole('button', { name: 'Save actions', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('saved');
  const second = await context.newPage();
  await second.goto('/');
  await unlockWorkspace(second);
  await second.getByRole('button', { name: 'Next steps', exact: true }).click();
  await page.getByRole('button', { name: 'Next steps', exact: true }).click();
  await page.getByLabel('Action', { exact: true }).fill('First tab: kept change');
  await page.getByRole('button', { name: 'Save actions', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('saved');
  await second.getByLabel('Action', { exact: true }).fill('Second tab: stale change');
  await second.getByRole('button', { name: 'Save actions', exact: true }).click();
  await expect(second.getByRole('alert')).toContainText('Another tab saved');
  await second.reload();
  await unlockWorkspace(second);
  await second.getByRole('button', { name: 'Next steps', exact: true }).click();
  await expect(second.getByLabel('Action', { exact: true })).toHaveValue('First tab: kept change');
});

test('three independent people share clues and complete a custom-role practice', async ({
  page,
  browser,
}, info) => {
  await page.goto('/practice');
  await page.getByRole('button', { name: 'Set up team practice', exact: true }).click();
  await page.waitForURL('**/room/**');
  const id = new URL(page.url()).pathname.split('/')[2];
  await page.getByRole('button', { name: 'Add your own role', exact: true }).click();
  await page.getByLabel('Role name', { exact: true }).fill('Volunteer lead');
  await page.getByLabel('Team communication', { exact: true }).check();
  await page.getByRole('button', { name: 'Save role', exact: true }).click();
  await expect(page.locator('.custom-role-list')).toContainText('Volunteer lead');
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext()));
  try {
    const players = await Promise.all(contexts.map((c) => c.newPage()));
    for (const [i, name] of ['Alex', 'Sam', 'Jo'].entries()) {
      await players[i].goto(`/join/${id}`);
      await players[i].getByLabel('Your name', { exact: true }).fill(name);
      await players[i].getByRole('button', { name: 'Join practice', exact: true }).click();
      await page
        .getByRole('combobox', { name: `Role for ${name}`, exact: true })
        .selectOption({ label: ['Account lead', 'Payments lead', 'Volunteer lead'][i] });
    }
    await page.screenshot({ path: info.outputPath('custom-roles.png'), fullPage: true });
    await page.getByRole('button', { name: 'Start practice', exact: true }).click();
    await expect(
      players[0].getByRole('heading', {
        name: 'Your work account no longer recognises you',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      players[1].getByRole('heading', {
        name: 'Your work account no longer recognises you',
        exact: true,
      }),
    ).toHaveCount(0);
    for (const label of [
      'Recover using the independent kit',
      'Rotate work credentials',
      'Revoke active sessions',
      'Review recovery settings',
      'Verify containment is complete',
    ]) {
      await players[0]
        .locator('.action-card')
        .filter({ has: players[0].getByRole('heading', { name: label, exact: true }) })
        .getByRole('button', { name: 'Choose this action', exact: true })
        .click();
    }
    await page.getByRole('button', { name: 'Continue: a suspicious request', exact: true }).click();
    await page.getByRole('button', { name: 'Continue: compare clues', exact: true }).click();
    await expect(
      players[1].getByRole('heading', { name: 'You have an independent contact', exact: true }),
    ).toHaveCount(0);
    await players[2]
      .locator('.observation')
      .filter({
        has: players[2].getByRole('heading', {
          name: 'You have an independent contact',
          exact: true,
        }),
      })
      .getByRole('button', { name: 'Share with the team', exact: true })
      .click();
    await expect(
      players[1].getByRole('heading', { name: 'You have an independent contact', exact: true }),
    ).toBeVisible();
    await players[1].reload();
    await players[1]
      .locator('.action-card')
      .filter({
        has: players[1].getByRole('heading', {
          name: 'Verify through the known contact',
          exact: true,
        }),
      })
      .getByRole('button', { name: 'Choose this action', exact: true })
      .click();
    await expect(
      page.getByText('Independent verification rejected the impersonated payment request.', {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Finish and review', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'What happened. What changes.', exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'What happened. What changes.', exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: info.outputPath('practice-summary.png'), fullPage: true });
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});

test('phone layout keeps the three steps and next action accessible', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createPlan(page);
  await page.getByRole('button', { name: 'My plan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Community Library', exact: true })).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Inspect a service', exact: true })
    .selectOption({ label: 'Independent backup' });
  await expect(
    page
      .getByRole('complementary', { name: 'Selected service' })
      .getByRole('heading', { name: 'Independent backup', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('phone-plan.png'), fullPage: true });
  await page
    .getByRole('navigation', { name: 'Workspace navigation' })
    .getByRole('button', { name: 'Check a problem', exact: true })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { name: 'What if you lose access?', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('setup keeps keyboard focus inside the dialog and restores it on Escape', async ({ page }) => {
  await openWorkspace(page);
  const open = page.getByRole('button', { name: 'Add first service', exact: true });
  await open.click();
  const dialog = page.getByRole('dialog');
  await dialog.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Save to map', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    dialog.getByRole('button', { name: 'Close service editor', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
});

test('direct editing preserves recovery data and checks three connected services', async ({
  page,
}, info) => {
  await createPlan(page);
  await page.getByRole('button', { name: 'My plan', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect Library email', exact: true }).click();
  await page.getByRole('button', { name: 'Edit this service', exact: true }).click();
  await expect(page.getByLabel('Recovery option', { exact: true })).toHaveValue(
    'Use independent backup',
  );
  await page.getByLabel('Service name', { exact: true }).fill('Team email');
  await page.getByRole('button', { name: 'Save to map', exact: true }).click();
  await page.getByRole('button', { name: 'Add a service', exact: true }).click();
  await page.getByLabel('Service name', { exact: true }).fill('Library website');
  await page.getByText('More details', { exact: true }).click();
  await page.getByRole('checkbox', { name: /Team email/ }).check();
  await page.getByRole('button', { name: 'Save to map', exact: true }).click();
  await page.getByRole('button', { name: 'Add a service', exact: true }).click();
  await page.getByLabel('Service name', { exact: true }).fill('Team chat');
  await page.screenshot({ path: info.outputPath('add-service.png'), fullPage: true });
  await page.getByRole('button', { name: 'Save to map', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect Use Team chat', exact: true }).click();
  await page.getByRole('button', { name: 'Edit this service', exact: true }).click();
  await page.getByLabel('Name of the work', { exact: true }).fill('Coordinate the volunteers');
  await expect(page.getByText('Unnamed resource', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save to map', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Inspect Coordinate the volunteers', exact: true }),
  ).toBeVisible();
  await page.reload();
  await unlockWorkspace(page);
  await page.getByRole('button', { name: 'Try a blackout', exact: true }).click();
  await expect(page.getByLabel('Impact on essential work')).toContainText('2 recoverable');
  await page.getByRole('button', { name: 'Independent backup backup', exact: true }).click();
  await expect(page.getByLabel('Impact on essential work')).toContainText('1 still working');
  await expect(page.getByLabel('Impact on essential work')).toContainText(
    '2 without a confirmed route',
  );
  await expect(
    page.getByRole('heading', { name: 'Coordinate the volunteers', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath('three-services.png'), fullPage: true });
});

test('team checks use the private map, approve owners, recover in order and download a summary', async ({
  page,
  browser,
}, info) => {
  await createPlan(page);
  await page.getByRole('button', { name: 'Edit this service', exact: true }).click();
  await page.getByText('Procedure and last check', { exact: true }).click();
  await page
    .getByLabel('Recovery instructions', { exact: true })
    .fill('PRIVATE-PROCEDURE-FOR-TEST');
  await page.getByText('More details', { exact: true }).click();
  await page.getByLabel('Notes', { exact: true }).fill('PRIVATE-ASSET-FOR-TEST');
  await page.getByRole('button', { name: 'Save to map', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'My plan', exact: true }).click();
  for (const [service, owner, prerequisite, method, evidence] of [
    [
      'Instagram',
      'Richard',
      'Library email',
      'Reset Instagram through library email',
      'user-reported',
    ],
    ['YouTube', 'Mary', 'Independent backup', 'Unconfirmed YouTube method', 'unknown'],
  ]) {
    await page.getByRole('button', { name: 'Add a service', exact: true }).click();
    await page.getByLabel('Service name', { exact: true }).fill(service);
    await page.getByLabel('Responsible person', { exact: true }).fill(owner);
    await page.getByRole('button', { name: 'Add recovery option', exact: true }).click();
    await page.getByLabel('Recovery option', { exact: true }).fill(method);
    await page
      .getByRole('group', { name: 'Recovery needs all of these', exact: true })
      .getByRole('checkbox', {
        name: `${prerequisite} ${prerequisite === 'Independent backup' ? 'backup' : 'account'}`,
        exact: true,
      })
      .check();
    await page
      .getByRole('combobox', { name: 'Have you checked it?', exact: true })
      .selectOption(evidence);
    await page.getByRole('button', { name: 'Save to map', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Try a blackout', exact: true }).click();
  await page.getByRole('button', { name: 'Instagram account', exact: true }).click();
  await page.getByRole('button', { name: 'YouTube account', exact: true }).click();
  await page.getByRole('button', { name: 'Check with team', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Create a team room', exact: true });
  await expect(preview).toContainText('Richard');
  await expect(preview).toContainText('Mary');
  await preview.getByText('View everything that will be shared', { exact: true }).click();
  await expect(preview.locator('pre')).not.toContainText('PRIVATE-');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Check with team', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Check with team', exact: true }).click();
  await page.getByLabel('Your name as host', { exact: true }).fill('Team host');
  const sharing = page.waitForRequest(
    (r) => r.url().endsWith('/api/plan-sessions') && r.method() === 'POST',
  );
  await page.getByRole('button', { name: 'Create team room', exact: true }).click();
  expect((await sharing).postData()).not.toContain('PRIVATE-');
  await page.waitForURL('**/room/**');
  const id = new URL(page.url()).pathname.split('/')[2];
  await expect(page.getByRole('heading', { name: 'Community Library', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start team check', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to my plan', exact: true }).click();
  await unlockWorkspace(page);
  await page.getByRole('button', { name: 'Save & restore', exact: true }).click();
  await page.getByText('Previous team rooms', { exact: true }).click();
  await page.getByRole('button', { name: /Community Library — team check/ }).click();
  await expect(page.getByRole('button', { name: 'Start team check', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('own-team-lobby.png'), fullPage: true });
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext()));
  try {
    const players = await Promise.all(contexts.map((c) => c.newPage()));
    for (const [i, name] of ['Alex', 'Richard', 'Mary'].entries()) {
      await players[i].goto(`/join/${id}`);
      await players[i].getByLabel('Your name', { exact: true }).fill(name);
      await players[i].getByRole('button', { name: 'Join team check', exact: true }).click();
      await expect(
        players[i].getByRole('heading', { name: 'Waiting for the host.', exact: true }),
      ).toBeVisible();
      await expect(
        players[i].getByRole('button', { name: 'Inspect Library email', exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole('combobox', { name: `Accounts for ${name}`, exact: true })
        .selectOption({ label: ['Volunteer lead', 'Richard', 'Mary'][i] });
      await expect(
        players[i].getByRole('heading', { name: 'Community Library', exact: true }),
      ).toBeVisible();
    }
    await page.getByText('Add a person or responsibility', { exact: true }).click();
    await page.getByLabel('Person or responsibility name', { exact: true }).fill('Backup lead');
    await page
      .getByRole('group', { name: 'Accounts they can handle in this check', exact: true })
      .getByRole('checkbox', { name: 'Library email', exact: true })
      .check();
    await page.getByRole('button', { name: 'Add responsibility', exact: true }).click();
    await expect(
      page.getByRole('combobox', { name: 'Accounts for Alex', exact: true }).locator('option'),
    ).toContainText([
      'Waiting for assignment',
      'Volunteer lead',
      'Richard',
      'Mary',
      'Backup lead',
      'All accounts',
      'Observer',
    ]);
    await page.getByRole('button', { name: 'Start team check', exact: true }).click();
    await expect(
      players[0].getByRole('button', { name: 'Record simulated recovery', exact: true }),
    ).toBeEnabled();
    await expect(
      players[1].getByRole('button', { name: 'Record simulated recovery', exact: true }),
    ).toBeDisabled();
    await expect(
      players[2].getByRole('button', { name: 'Record simulated recovery', exact: true }),
    ).toBeDisabled();
    await players[0]
      .getByRole('button', { name: 'Record simulated recovery', exact: true })
      .click();
    await expect(
      players[1].getByRole('button', { name: 'Record simulated recovery', exact: true }),
    ).toBeEnabled();
    await players[1].reload();
    await players[1]
      .getByRole('button', { name: 'Record simulated recovery', exact: true })
      .click();
    await expect(page.getByLabel('Shared work status', { exact: true })).toContainText(
      '2 available now',
    );
    await expect(
      players[2].getByText('Recovery method needs confirmation', { exact: true }),
    ).toBeVisible();
    await players[2].setViewportSize({ width: 390, height: 844 });
    expect(await players[2].evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await expect(page.getByRole('button', { name: 'Inspect YouTube', exact: true })).toContainText(
      'Selected loss',
    );
    await expect(
      page.getByRole('button', { name: 'Inspect Use YouTube', exact: true }),
    ).toContainText('Unconfirmed');
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await page
      .getByRole('button', { name: 'Inspect Use YouTube', exact: true })
      .screenshot({ path: info.outputPath('unconfirmed-node.png') });
    await page.screenshot({ path: info.outputPath('own-team-running.png'), fullPage: true });
    await page.getByRole('button', { name: 'Finish team check', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'What to prepare next', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Confirm recovery for YouTube', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Save check summary', exact: true }).click();
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download HTML plan', exact: true }).click();
    const summary = await downloading;
    await summary.saveAs(info.outputPath('own-team-summary.html'));
    const html = await readFile(info.outputPath('own-team-summary.html'), 'utf8');
    expect(html).toContain('Team check — simulated results');
    expect(html).toContain('Alex');
    expect(html).toContain('Richard');
    expect(html).not.toContain('PRIVATE-');
    await page.getByRole('button', { name: 'Close saved copy', exact: true }).click();
    await page.getByText('Room controls', { exact: true }).click();
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Delete shared room', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Unlock your recovery plans.', exact: true }),
    ).toBeVisible();
    for (const player of players)
      await expect(
        player.getByRole('heading', { name: 'Room no longer available.', exact: true }),
      ).toBeVisible();
    await unlockWorkspace(page);
    await page.getByRole('button', { name: 'Inspect Library email', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Selected service' })).toContainText(
      'PRIVATE-ASSET-FOR-TEST',
    );
  } finally {
    for (const c of contexts) await c.close();
  }
});
