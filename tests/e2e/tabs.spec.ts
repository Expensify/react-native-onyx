import {test, expect} from '@playwright/test';

test.describe('multiple tabs', () => {
  test('logs in in all tabs', async ({page, context}) => {
    const secondPage = await context.newPage();
    const thirdPage = await context.newPage();

    await page.goto('/');
    await secondPage.goto('/');
    await thirdPage.goto('/');

    const logInButton = page.getByTestId('log-in');
    await logInButton.click();

    const logOutButtonPage = page.getByTestId('log-out');
    expect(logOutButtonPage).toBeTruthy();

    const logOutButtonSecondPage = secondPage.getByTestId('log-out');
    expect(logOutButtonSecondPage).toBeTruthy();

    const logOutButtonThirdPage = thirdPage.getByTestId('log-out');
    expect(logOutButtonThirdPage).toBeTruthy();
  });

  test('fetch should stop after log out', async ({page, context}) => {
    const secondPage = await context.newPage();
    const thirdPage = await context.newPage();

    await page.goto('/');
    await secondPage.goto('/');
    await thirdPage.goto('/');

    await page.getByText('Log In').click();

    await secondPage.getByTestId('log-out').waitFor({state: 'visible'});
    await thirdPage.getByTestId('fetch-space-data').waitFor({state: 'visible'});

    await thirdPage.getByTestId('fetch-space-data').click();
    await page.getByTestId('fetch-space-data').click();
    await secondPage.getByTestId('log-out').click();

    await secondPage.getByTestId('log-in').waitFor({state: 'visible'});
    await thirdPage.getByTestId('log-in').waitFor({state: 'visible'});

    await page.reload();
    await thirdPage.reload();

    expect(secondPage.getByTestId('log-in')).toBeTruthy();
    expect(thirdPage.getByTestId('log-in')).toBeTruthy();

    await expect(page.getByLabel('data-meteorites')).toBeEmpty();
    await expect(secondPage.getByLabel('data-meteorites')).toBeEmpty();
    await expect(thirdPage.getByLabel('data-meteorites')).toBeEmpty();
  });

  test('should update in the same order between tabs', async ({
    page,
    context,
  }) => {
    await page.goto('/');

    await page.getByTestId('log-in').click();
    await page.getByTestId('fetch-small-space-data').click();

    await expect(page.getByLabel('data-meteorites')).not.toBeEmpty();

    // Opens new page and reloads the first one
    const secondPage = await context.newPage();
    await page.reload();
    await secondPage.goto('/');

    const updatesFirstPage = page.getByLabel('data-updates');
    const updatesSecondPage = secondPage.getByLabel('data-updates');
    let updatesFirstPageText = await updatesFirstPage.innerText();
    let updatesSecondPageText = await updatesFirstPage.innerText();

    // Checks that the update keys ordering is matching
    expect(updatesFirstPageText).toEqual(updatesSecondPageText);

    const logOutButtonSecondPage = secondPage.getByTestId('log-out');
    await logOutButtonSecondPage.click();

    // waits for the log in button to appear
    await page.getByTestId('log-in').waitFor({state: 'visible'});

    const updatesTextFirstPage = await updatesFirstPage.innerText();
    const updatesTextSecondPage = await updatesSecondPage.innerText();

    // This should fail
    expect(updatesTextFirstPage).toEqual(updatesTextSecondPage);
  });

  test('[POC] updates the leader tab when tabs are closed', async ({
    page,
    context,
  }) => {
    const secondPage = await context.newPage();
    const thirdPage = await context.newPage();

    await page.goto('/');
    await secondPage.goto('/');
    await thirdPage.goto('/');

    await expect(page.getByLabel('leader')).toHaveText('non-leader');
    await expect(secondPage.getByLabel('leader')).toHaveText('non-leader');
    await expect(thirdPage.getByLabel('leader')).toHaveText('leader');

    await secondPage.close({runBeforeUnload: true});
    await thirdPage.close({runBeforeUnload: true});

    // wait for the change propagate
    await page.getByLabel('leader').waitFor();

    await expect(page.getByLabel('leader')).toHaveText('leader');
  });

  test('[POC] should still execute updates to the data after closing the leader tab', async ({
    page,
    context,
  }) => {
    await page.goto('/');

    const secondPage = await context.newPage();
    const thirdPage = await context.newPage();

    // force the third page to be the leader
    await secondPage.goto('/');
    await thirdPage.goto('/');

    await page.getByTestId('log-in').click();

    expect(page.getByTestId('log-out')).toBeTruthy();
    expect(secondPage.getByTestId('log-out')).toBeTruthy();
    expect(thirdPage.getByTestId('log-out')).toBeTruthy();

    thirdPage.close({runBeforeUnload: true});

    await page.getByTestId('log-out').click();

    expect(page.getByTestId('log-in')).toBeTruthy();
    expect(secondPage.getByTestId('log-in')).toBeTruthy();
  });
});
