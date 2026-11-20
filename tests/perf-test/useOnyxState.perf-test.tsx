import {act, screen} from '@testing-library/react-native';
import React from 'react';
import {Text, View} from 'react-native';
import {measureRenders} from 'reassure';

import type {OnyxStateView} from '../../lib/useOnyxState';

import Onyx from '../../lib';
import useOnyxState from '../../lib/useOnyxState';

const COLLECTION_KEY = 'report_';
const UPDATES = 5;

function nameOf(value: unknown): string | undefined {
    return typeof value === 'object' && value !== null && 'name' in value && typeof value.name === 'string' ? value.name : undefined;
}

const memberKey = (index: number) => `${COLLECTION_KEY}${index}`;

const seedCollection = async (size: number) => {
    const collection = Object.fromEntries(Array.from({length: size}, (_, index) => [memberKey(index), {reportID: String(index), name: `report ${index}`, total: index}]));
    await Onyx.mergeCollection(COLLECTION_KEY, collection);
};

function Row({index}: {index: number}) {
    const key = memberKey(index);
    const name = useOnyxState((state: OnyxStateView) => nameOf(state[key]));
    return <Text>{`row ${index}: ${name ?? ''}`}</Text>;
}

function Rows({count}: {count: number}) {
    return (
        <View>
            {Array.from({length: count}, (_, index) => (
                <Row
                    key={index}
                    index={index}
                />
            ))}
        </View>
    );
}

function CollectionCount() {
    const count = useOnyxState((state: OnyxStateView) => {
        const collection = state[COLLECTION_KEY];
        return typeof collection === 'object' && collection !== null ? Object.keys(collection).length : 0;
    });
    return <Text>{`count: ${count}`}</Text>;
}

const runUpdates = async (update: (step: number) => Promise<void>) => {
    for (let step = 0; step < UPDATES; step++) {
        await act(async () => {
            await update(step);
        });
    }
};

describe('useOnyxState', () => {
    beforeAll(() => {
        Onyx.init({keys: {COLLECTION: {REPORT: COLLECTION_KEY}}});
    });

    afterEach(async () => {
        await Onyx.clear();
    });

    describe.each([100, 1000])('%i rows', (rows) => {
        test('one rendered row member changes', async () => {
            await measureRenders(<Rows count={rows} />, {
                beforeEach: () => seedCollection(rows * 2),
                scenario: async () => {
                    await screen.findByText('row 0: report 0');
                    await runUpdates((step) => Onyx.merge(memberKey(0), {name: `renamed ${step}`}));
                    await screen.findByText(`row 0: renamed ${UPDATES - 1}`);
                },
                afterEach: () => Onyx.clear(),
            });
        });

        test('member outside the rows changes', async () => {
            await measureRenders(<Rows count={rows} />, {
                beforeEach: () => seedCollection(rows * 2),
                scenario: async () => {
                    await screen.findByText('row 0: report 0');
                    await runUpdates((step) => Onyx.merge(memberKey(rows + step), {name: `renamed ${step}`}));
                },
                afterEach: () => Onyx.clear(),
            });
        });

        test('mergeCollection over 50 members outside the rows', async () => {
            await measureRenders(<Rows count={rows} />, {
                beforeEach: () => seedCollection(rows * 2),
                scenario: async () => {
                    await screen.findByText('row 0: report 0');
                    await runUpdates((step) => Onyx.mergeCollection(COLLECTION_KEY, Object.fromEntries(Array.from({length: 50}, (_, i) => [memberKey(rows + i), {total: step * 1000 + i}]))));
                },
                afterEach: () => Onyx.clear(),
            });
        });
    });

    test('selector reading the collection root, member changes', async () => {
        await measureRenders(<CollectionCount />, {
            beforeEach: () => seedCollection(1000),
            scenario: async () => {
                await screen.findByText('count: 1000');
                await runUpdates((step) => Onyx.merge(memberKey(step), {total: step + 1}));
            },
            afterEach: () => Onyx.clear(),
        });
    });
});
