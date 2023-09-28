import {test, expect} from '@playwright/test';

test.describe('clear', () => {
  test('clear data on logout', async ({page}) => {
    await page.goto('/');

    const logInButton = page.getByTestId('log-in');
    expect(logInButton).toBeTruthy();

    await logInButton.click();

    const logOutButton = page.getByTestId('log-out');
    expect(logOutButton).toBeTruthy();

    const fetchPokedexButton = page.getByTestId('fetch-pokedex-data');
    expect(fetchPokedexButton).toBeTruthy();

    await fetchPokedexButton.click();
    await expect(page.getByLabel('data-pokedex')).toHaveText('151');

    await logOutButton.click();

    await expect(page.getByLabel('data-pokedex')).toBeEmpty();

    await page.reload();

    await expect(page.getByLabel('data-pokedex')).toBeEmpty();
  });

  test('clear big amount of data on logout', async ({page}) => {
    await page.goto('/');

    expect(page.getByTestId('log-in')).toBeTruthy();
    await page.getByTestId('log-in').click();

    const logOutButton = page.getByTestId('log-out');
    expect(logOutButton).toBeTruthy();

    const fetchPokedexButton = page.getByTestId('fetch-pokedex-data');
    expect(fetchPokedexButton).toBeTruthy();

    const fetchMeteoritesButton = page.getByTestId('fetch-space-data');
    expect(fetchMeteoritesButton).toBeTruthy();

    await fetchPokedexButton.click();
    const fetchPokedexData = page.getByLabel('data-pokedex');
    expect(fetchPokedexData).toHaveText('151');

    await fetchMeteoritesButton.click();
    const fetchMeteoritesData = page.getByLabel('data-meteorites');
    await expect(fetchMeteoritesData).toContainText('meteorites_');

    const fetchAsteroidsData = page.getByLabel('data-asteroids');
    await expect(fetchAsteroidsData).toContainText('asteroids_');

    await logOutButton.click();

    // wait for at least some of the clear to have been propagated
    await expect(fetchPokedexData).toBeEmpty();
    expect(fetchMeteoritesData).toBeEmpty();
    expect(fetchAsteroidsData).toBeEmpty();

    await page.reload();

    await expect(fetchMeteoritesData).toBeEmpty();
    await expect(fetchAsteroidsData).toBeEmpty();
  });
});
