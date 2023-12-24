/* eslint-disable @lwc/lwc/no-async-await */
import {test, expect} from '@playwright/test';

test.describe('multiple tabs', () => {
    test('logs in in all tabs', async ({page, context}) => {
        const secondPage = await context.newPage();
        const thirdPage = await context.newPage();

        await page.goto('/');
        await secondPage.goto('/');
        await thirdPage.goto('/');

        await page.getByRole('button', {name: 'Log In'}).click();

        await expect(page.getByRole('button', {name: 'Log Out'})).toBeVisible();
        await expect(secondPage.getByRole('button', {name: 'Log Out'})).toBeVisible();
        await expect(thirdPage.getByRole('button', {name: 'Log Out'})).toBeVisible();
    });

    test('fetch should stop after log out', async ({page, context}) => {
        const secondPage = await context.newPage();
        const thirdPage = await context.newPage();

        await page.goto('/');
        await secondPage.goto('/');
        await thirdPage.goto('/');

        await page.getByRole('button', {name: 'Log In'}).click();

        await secondPage.getByRole('button', {name: 'Log Out'}).waitFor({state: 'visible'});
        await thirdPage.getByTestId('fetch-space-data').waitFor({state: 'visible'});

        await thirdPage.getByTestId('fetch-space-data').click();
        await page.getByTestId('fetch-space-data').click();
        await secondPage.getByRole('button', {name: 'Log Out'}).click();

        await page.getByRole('button', {name: 'Log In'}).waitFor({state: 'visible'});
        await thirdPage.getByRole('button', {name: 'Log In'}).waitFor({state: 'visible'});

        await page.reload();
        await thirdPage.reload();

        await expect(page.getByRole('button', {name: 'Log In'})).toBeVisible();
        await expect(thirdPage.getByRole('button', {name: 'Log In'})).toBeVisible();

        await expect(page.getByLabel('data-meteorites')).toBeEmpty();
        await expect(secondPage.getByLabel('data-meteorites')).toBeEmpty();
        await expect(thirdPage.getByLabel('data-meteorites')).toBeEmpty();
    });

    test('updates the leader tab when tabs are closed', async ({page, context}) => {
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

    test('should still execute updates to the data after closing the leader tab', async ({page, context}) => {
        await page.goto('/');

        const secondPage = await context.newPage();
        const thirdPage = await context.newPage();

        // force the third page to be the leader
        await secondPage.goto('/');
        await thirdPage.goto('/');

        await expect(thirdPage.getByLabel('leader')).toHaveText('leader');

        await page.getByRole('button', {name: 'Log In'}).click();

        await expect(page.getByRole('button', {name: 'Log Out'})).toBeVisible();
        await expect(secondPage.getByRole('button', {name: 'Log Out'})).toBeVisible();
        await expect(thirdPage.getByRole('button', {name: 'Log Out'})).toBeVisible();

        await thirdPage.close({runBeforeUnload: true});

        await page.getByRole('button', {name: 'Log Out'}).click();

        await expect(page.getByRole('button', {name: 'Log In'})).toBeVisible();
        await expect(secondPage.getByRole('button', {name: 'Log In'})).toBeVisible();
    });
});
