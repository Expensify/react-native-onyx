/* eslint-disable @lwc/lwc/no-async-await */
import {test, expect} from '@playwright/test';

test.describe('one tab', () => {
    test('shows login button', async ({page}) => {
        await page.goto('/');

        await expect(page.getByRole('button', {name: 'Log In'})).toBeTruthy();
    });

    test('logs in after clicking button', async ({page}) => {
        await page.goto('/');

        await page.getByRole('button', {name: 'Log In'}).click();

        await expect(page.getByRole('button', {name: 'Log Out'})).toBeVisible();
        await expect(page.getByLabel('data-number')).toBeVisible();

        // eslint-disable-next-line quotes
        await expect(page.getByLabel('data-updates')).toHaveText('["session","randomNumber"]');
    });

    test('logs out in after clicking button', async ({page}) => {
        await page.goto('/');

        await page.getByRole('button', {name: 'Log In'}).click();

        await expect(page.getByRole('button', {name: 'Log Out'})).toBeVisible();
        await expect(page.getByLabel('data-number')).toBeVisible();

        // eslint-disable-next-line quotes
        await expect(page.getByLabel('data-updates')).toHaveText('["session","randomNumber"]');

        await page.getByRole('button', {name: 'Log Out'}).click();

        await expect(page.getByRole('button', {name: 'Log In'})).toBeVisible();
        await expect(page.getByLabel('data-updates')).toHaveText(
            // eslint-disable-next-line quotes
            '["session","randomNumber","session","randomNumber"]',
        );
    });
});
