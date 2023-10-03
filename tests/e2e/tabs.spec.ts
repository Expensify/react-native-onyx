/* eslint-disable @lwc/lwc/no-async-await */
import {test, expect} from '@playwright/test';

test.describe('multiple tabs', () => {
    test('logs in in all tabs', async ({page, context}) => {
        const secondPage = await context.newPage();
        const thirdPage = await context.newPage();

        await page.goto('/');
        await secondPage.goto('/');
        await thirdPage.goto('/');

        await page.getByTestId('log-in').click();

        expect(page.getByTestId('log-out')).toBeTruthy();
        expect(secondPage.getByTestId('log-out')).toBeTruthy();
        expect(thirdPage.getByTestId('log-out')).toBeTruthy();
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

    test('updates the leader tab when tabs are closed', async ({
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

    test('should still execute updates to the data after closing the leader tab', async ({
        page,
        context,
    }) => {
        await page.goto('/');

        const secondPage = await context.newPage();
        const thirdPage = await context.newPage();

        // force the third page to be the leader
        await secondPage.goto('/');
        await thirdPage.goto('/');

        await expect(thirdPage.getByLabel('leader')).toHaveText('leader');

        await page.getByTestId('log-in').click();
        await page.getByTestId('log-out').waitFor({state: 'visible'});

        expect(page.getByTestId('log-out')).toBeTruthy();
        expect(secondPage.getByTestId('log-out')).toBeTruthy();
        expect(thirdPage.getByTestId('log-out')).toBeTruthy();

        await thirdPage.close({runBeforeUnload: true});

        await page.getByTestId('log-out').click();

        expect(page.getByTestId('log-in')).toBeTruthy();
        expect(secondPage.getByTestId('log-in')).toBeTruthy();
    });
});
