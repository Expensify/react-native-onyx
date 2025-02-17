import {measureFunction} from 'reassure';

describe('Onyx', () => {
    test('connect', async () => {
        await measureFunction(() => undefined);
    });

    test('disconnect', async () => {
        await measureFunction(() => undefined);
    });

    test('set', async () => {
        await measureFunction(() => undefined);
    });

    test('multiSet', async () => {
        await measureFunction(() => undefined);
    });

    test('merge', async () => {
        await measureFunction(() => undefined);
    });

    test('mergeCollection', async () => {
        await measureFunction(() => undefined);
    });

    test('setCollection', async () => {
        await measureFunction(() => undefined);
    });

    test('update', async () => {
        await measureFunction(() => undefined);
    });

    test('clear', async () => {
        await measureFunction(() => undefined);
    });

    test('init', async () => {
        await measureFunction(() => undefined);
    });
});
