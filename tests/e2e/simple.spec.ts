/* eslint-disable @lwc/lwc/no-async-await */
import {test, expect} from '@playwright/test';

test.describe('simple', () => {
    test('shows login button', async ({page}) => {
        await page.goto('/');

        const logInButton = page.getByTestId('log-in');
        expect(logInButton).toBeTruthy();
    });

    test('logs in after clicking button', async ({page}) => {
        await page.goto('/');

        const logInButton = page.getByTestId('log-in');
        await logInButton.click();

        const logOutButton = page.getByTestId('log-out');
        const numberElement = page.getByLabel('data-number');

        await expect(logOutButton).toBeTruthy();
        expect(numberElement).toBeTruthy();

        const updatesTextElement = page.getByLabel('data-updates');
        // eslint-disable-next-line quotes
        await expect(updatesTextElement).toHaveText("[\"session\",\"randomNumber\"]");
    });

    test('logs out in after clicking button', async ({page}) => {
        await page.goto('/');

        const logInButton = page.getByTestId('log-in');
        await logInButton.click();

        const logOutButton = page.getByTestId('log-out');
        const numberElement = page.getByLabel('data-number');
        expect(logOutButton).toBeTruthy();
        expect(numberElement).toBeTruthy();

        const updatesTextElement = page.getByLabel('data-updates');
        // eslint-disable-next-line quotes
        expect(updatesTextElement).toHaveText("[\"session\",\"randomNumber\"]");

        await logOutButton.click();

        await expect(logInButton).toBeTruthy();
        await expect(updatesTextElement).toHaveText(
            // eslint-disable-next-line quotes
            "[\"session\",\"randomNumber\",\"session\",\"randomNumber\"]",
        );
    });
});
