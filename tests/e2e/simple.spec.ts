/* eslint-disable @lwc/lwc/no-async-await */
import {test, expect} from '@playwright/test';

test.describe('simple', () => {
    test('shows login button', async ({page}) => {
        await page.goto('/');

        expect(page.getByTestId('log-in')).toBeTruthy();
    });

    test('logs in after clicking button', async ({page}) => {
        await page.goto('/');

        await page.getByTestId('log-in').click();

        expect(page.getByTestId('log-out')).toBeTruthy();
        await expect(page.getByLabel('data-number')).toBeTruthy();

        // eslint-disable-next-line quotes
        await expect(page.getByLabel('data-updates')).toHaveText("[\"session\",\"randomNumber\"]");
    });

    test('logs out in after clicking button', async ({page}) => {
        await page.goto('/');

        await page.getByTestId('log-in').click();

        expect(page.getByTestId('log-out')).toBeTruthy();
        await expect(page.getByLabel('data-number')).toBeTruthy();

        // eslint-disable-next-line quotes
        await expect(page.getByLabel('data-updates')).toHaveText("[\"session\",\"randomNumber\"]");

        await page.getByTestId('log-out').click();

        expect(page.getByTestId('log-in')).toBeTruthy();
        await expect(page.getByLabel('data-updates')).toHaveText(
            // eslint-disable-next-line quotes
            "[\"session\",\"randomNumber\",\"session\",\"randomNumber\"]",
        );
    });
});
