import {screen} from '@testing-library/react-native';
import React from 'react';
import {Text, View} from 'react-native';
import {measureRenders} from 'reassure';
import type {FetchStatus, OnyxEntry, OnyxKey, OnyxValue, ResultMetadata, UseOnyxOptions} from '../../lib';
import Onyx, {useOnyx} from '../../lib';
import type {UseOnyxSelector} from '../../lib/useOnyx';

const ONYXKEYS = {
    TEST_KEY: 'test',
    TEST_KEY_2: 'test2',
    TEST_KEY_3: 'test3',
    RAM_ONLY_TEST_KEY: 'ramOnlyTestKey',
    COLLECTION: {
        TEST_KEY: 'test_',
    },
};

const dataMatcher = (onyxKey: OnyxKey, expected: unknown) => `data: ${onyxKey}_${JSON.stringify(expected)}`;
const metadataStatusMatcher = (onyxKey: OnyxKey, expected: FetchStatus) => `metadata.status: ${onyxKey}_${expected}`;

type UseOnyxMatcherProps = {
    onyxKey: OnyxKey;
    data: OnyxValue<OnyxKey>;
    metadata: ResultMetadata;
};

function UseOnyxMatcher({onyxKey, data, metadata}: UseOnyxMatcherProps) {
    return (
        <View>
            <Text>{dataMatcher(onyxKey, data)}</Text>
            <Text>{metadataStatusMatcher(onyxKey, metadata.status)}</Text>
        </View>
    );
}

type UseOnyxWrapperProps = {
    onyxKey: OnyxKey;
    onyxOptions?: UseOnyxOptions<OnyxKey, OnyxValue<OnyxKey>>;
};

function UseOnyxWrapper({onyxKey, onyxOptions}: UseOnyxWrapperProps) {
    const [data, metadata] = useOnyx(onyxKey, onyxOptions);

    return (
        <UseOnyxMatcher
            onyxKey={onyxKey}
            data={data}
            metadata={metadata}
        />
    );
}

const clearOnyxAfterEachMeasure = async () => {
    await Onyx.clear();
};

describe('useOnyx', () => {
    beforeAll(async () => {
        Onyx.init({
            keys: ONYXKEYS,
            ramOnlyKeys: [ONYXKEYS.RAM_ONLY_TEST_KEY],
        });
    });

    afterEach(async () => {
        await Onyx.clear();
    });

    describe('misc', () => {
        /**
         * Expected renders: 2.
         */
        test('no data in storage/cache', async () => {
            const key = ONYXKEYS.TEST_KEY;
            await measureRenders(<UseOnyxWrapper onyxKey={key} />, {
                scenario: async () => {
                    await screen.findByText(dataMatcher(key, undefined));
                    await screen.findByText(metadataStatusMatcher(key, 'loaded'));
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });

        /**
         * Expected renders: 1.
         */
        test('data in storage and cache', async () => {
            const key = ONYXKEYS.TEST_KEY;
            await measureRenders(<UseOnyxWrapper onyxKey={key} />, {
                beforeEach: async () => {
                    await Onyx.set(key, 'test');
                },
                scenario: async () => {
                    await screen.findByText(dataMatcher(key, 'test'));
                    await screen.findByText(metadataStatusMatcher(key, 'loaded'));
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });

        /**
         * Expected renders: 2.
         */
        test('multiple merge operations', async () => {
            const key = ONYXKEYS.TEST_KEY;
            await measureRenders(<UseOnyxWrapper onyxKey={key} />, {
                beforeEach: async () => {
                    Onyx.merge(key, 'test1');
                    Onyx.merge(key, 'test2');
                    Onyx.merge(key, 'test3');
                },
                scenario: async () => {
                    await screen.findByText(dataMatcher(key, 'test3'));
                    await screen.findByText(metadataStatusMatcher(key, 'loaded'));
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });

        /**
         * Expected renders: 1.
         *
         * A write to an unrelated key must not re-render a subscriber of a different key.
         */
        test('unrelated key change does not re-render', async () => {
            const key = ONYXKEYS.TEST_KEY;
            await measureRenders(<UseOnyxWrapper onyxKey={key} />, {
                beforeEach: async () => {
                    await Onyx.set(key, 'test');
                },
                scenario: async () => {
                    await screen.findByText(dataMatcher(key, 'test'));
                    await screen.findByText(metadataStatusMatcher(key, 'loaded'));

                    Onyx.merge(ONYXKEYS.TEST_KEY_2, 'other');

                    await screen.findByText(dataMatcher(key, 'test'));
                    await screen.findByText(metadataStatusMatcher(key, 'loaded'));
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });
    });

    describe('selector', () => {
        /**
         * Expected renders: 1.
         */
        test('updating data that is not used by selector', async () => {
            const key = ONYXKEYS.TEST_KEY;
            await measureRenders(
                <UseOnyxWrapper
                    onyxKey={key}
                    onyxOptions={{
                        selector: ((entry: OnyxEntry<{id: string; name: string}>) => `${entry?.name}_changed`) as UseOnyxSelector<OnyxKey, string>,
                    }}
                />,
                {
                    beforeEach: async () => {
                        await Onyx.set(key, {id: 'test_id', name: 'test_name'});
                    },
                    scenario: async () => {
                        await screen.findByText(dataMatcher(key, 'test_name_changed'));
                        await screen.findByText(metadataStatusMatcher(key, 'loaded'));

                        Onyx.merge(key, {id: 'test_id'});

                        await screen.findByText(dataMatcher(key, 'test_name_changed'));
                        await screen.findByText(metadataStatusMatcher(key, 'loaded'));
                    },
                    afterEach: clearOnyxAfterEachMeasure,
                },
            );
        });

        /**
         * Expected renders: 2.
         */
        test('updating data that is used by selector', async () => {
            const key = ONYXKEYS.TEST_KEY;
            await measureRenders(
                <UseOnyxWrapper
                    onyxKey={key}
                    onyxOptions={{
                        selector: ((entry: OnyxEntry<{id: string; name: string}>) => `${entry?.name}_changed`) as UseOnyxSelector<OnyxKey, string>,
                    }}
                />,
                {
                    beforeEach: async () => {
                        await Onyx.set(key, {id: 'test_id', name: 'test_name'});
                    },
                    scenario: async () => {
                        await screen.findByText(dataMatcher(key, 'test_name_changed'));
                        await screen.findByText(metadataStatusMatcher(key, 'loaded'));

                        Onyx.merge(key, {name: 'test_name2'});

                        await screen.findByText(dataMatcher(key, 'test_name2_changed'));
                        await screen.findByText(metadataStatusMatcher(key, 'loaded'));
                    },
                    afterEach: clearOnyxAfterEachMeasure,
                },
            );
        });
    });

    describe('multiple calls', () => {
        /**
         * Expected renders: 1.
         */
        test('3 calls loading from cache', async () => {
            function TestComponent() {
                const [testKeyData, testKeyMetadata] = useOnyx(ONYXKEYS.TEST_KEY);
                const [testKey2Data, testKey2Metadata] = useOnyx(ONYXKEYS.TEST_KEY_2);
                const [testKey3Data, testKey3Metadata] = useOnyx(ONYXKEYS.TEST_KEY_3);

                return (
                    <View>
                        <UseOnyxMatcher
                            onyxKey={ONYXKEYS.TEST_KEY}
                            data={testKeyData}
                            metadata={testKeyMetadata}
                        />
                        <UseOnyxMatcher
                            onyxKey={ONYXKEYS.TEST_KEY_2}
                            data={testKey2Data}
                            metadata={testKey2Metadata}
                        />
                        <UseOnyxMatcher
                            onyxKey={ONYXKEYS.TEST_KEY_3}
                            data={testKey3Data}
                            metadata={testKey3Metadata}
                        />
                    </View>
                );
            }

            await measureRenders(<TestComponent />, {
                beforeEach: async () => {
                    await Onyx.set(ONYXKEYS.TEST_KEY, 'test');
                    await Onyx.set(ONYXKEYS.TEST_KEY_2, 'test2');
                    await Onyx.set(ONYXKEYS.TEST_KEY_3, 'test3');
                },
                scenario: async () => {
                    await screen.findByText(dataMatcher(ONYXKEYS.TEST_KEY, 'test'));
                    await screen.findByText(metadataStatusMatcher(ONYXKEYS.TEST_KEY, 'loaded'));
                    await screen.findByText(dataMatcher(ONYXKEYS.TEST_KEY_2, 'test2'));
                    await screen.findByText(metadataStatusMatcher(ONYXKEYS.TEST_KEY_2, 'loaded'));
                    await screen.findByText(dataMatcher(ONYXKEYS.TEST_KEY_3, 'test3'));
                    await screen.findByText(metadataStatusMatcher(ONYXKEYS.TEST_KEY_3, 'loaded'));
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });

        /**
         * Expected renders: 2.
         */
        test('3 calls loading from cache + merges', async () => {
            function TestComponent() {
                const [testKeyData, testKeyMetadata] = useOnyx(ONYXKEYS.TEST_KEY);
                const [testKey2Data, testKey2Metadata] = useOnyx(ONYXKEYS.TEST_KEY_2);
                const [testKey3Data, testKey3Metadata] = useOnyx(ONYXKEYS.TEST_KEY_3);

                return (
                    <View>
                        <UseOnyxMatcher
                            onyxKey={ONYXKEYS.TEST_KEY}
                            data={testKeyData}
                            metadata={testKeyMetadata}
                        />
                        <UseOnyxMatcher
                            onyxKey={ONYXKEYS.TEST_KEY_2}
                            data={testKey2Data}
                            metadata={testKey2Metadata}
                        />
                        <UseOnyxMatcher
                            onyxKey={ONYXKEYS.TEST_KEY_3}
                            data={testKey3Data}
                            metadata={testKey3Metadata}
                        />
                    </View>
                );
            }

            await measureRenders(<TestComponent />, {
                beforeEach: async () => {
                    await Onyx.set(ONYXKEYS.TEST_KEY, 'test');
                    await Onyx.set(ONYXKEYS.TEST_KEY_2, 'test2');
                    await Onyx.set(ONYXKEYS.TEST_KEY_3, 'test3');
                },
                scenario: async () => {
                    await screen.findByText(dataMatcher(ONYXKEYS.TEST_KEY, 'test'));
                    await screen.findByText(metadataStatusMatcher(ONYXKEYS.TEST_KEY, 'loaded'));
                    await screen.findByText(dataMatcher(ONYXKEYS.TEST_KEY_2, 'test2'));
                    await screen.findByText(metadataStatusMatcher(ONYXKEYS.TEST_KEY_2, 'loaded'));
                    await screen.findByText(dataMatcher(ONYXKEYS.TEST_KEY_3, 'test3'));
                    await screen.findByText(metadataStatusMatcher(ONYXKEYS.TEST_KEY_3, 'loaded'));

                    Onyx.merge(ONYXKEYS.TEST_KEY, 'test_changed');
                    Onyx.merge(ONYXKEYS.TEST_KEY_2, 'test2_changed');
                    Onyx.merge(ONYXKEYS.TEST_KEY_3, 'test3_changed');

                    await screen.findByText(dataMatcher(ONYXKEYS.TEST_KEY, 'test_changed'));
                    await screen.findByText(dataMatcher(ONYXKEYS.TEST_KEY_2, 'test2_changed'));
                    await screen.findByText(dataMatcher(ONYXKEYS.TEST_KEY_3, 'test3_changed'));
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });
    });

    describe('collection', () => {
        const memberCountSelector = ((collection: OnyxEntry<Record<string, unknown>>) => String(Object.keys(collection ?? {}).length)) as UseOnyxSelector<OnyxKey, string>;

        /**
         * Expected renders: 1.
         */
        test('collection loaded from cache', async () => {
            await measureRenders(
                <UseOnyxWrapper
                    onyxKey={ONYXKEYS.COLLECTION.TEST_KEY}
                    onyxOptions={{selector: memberCountSelector}}
                />,
                {
                    beforeEach: async () => {
                        await Onyx.mergeCollection(ONYXKEYS.COLLECTION.TEST_KEY, {[`${ONYXKEYS.COLLECTION.TEST_KEY}1`]: {name: 'a'}, [`${ONYXKEYS.COLLECTION.TEST_KEY}2`]: {name: 'b'}});
                    },
                    scenario: async () => {
                        await screen.findByText(dataMatcher(ONYXKEYS.COLLECTION.TEST_KEY, '2'));
                        await screen.findByText(metadataStatusMatcher(ONYXKEYS.COLLECTION.TEST_KEY, 'loaded'));
                    },
                    afterEach: clearOnyxAfterEachMeasure,
                },
            );
        });

        /**
         * Expected renders: 2.
         *
         * Adding a member re-delivers the collection object to the root subscriber.
         */
        test('collection re-renders when a member is added', async () => {
            await measureRenders(
                <UseOnyxWrapper
                    onyxKey={ONYXKEYS.COLLECTION.TEST_KEY}
                    onyxOptions={{selector: memberCountSelector}}
                />,
                {
                    beforeEach: async () => {
                        await Onyx.mergeCollection(ONYXKEYS.COLLECTION.TEST_KEY, {[`${ONYXKEYS.COLLECTION.TEST_KEY}1`]: {name: 'a'}, [`${ONYXKEYS.COLLECTION.TEST_KEY}2`]: {name: 'b'}});
                    },
                    scenario: async () => {
                        await screen.findByText(dataMatcher(ONYXKEYS.COLLECTION.TEST_KEY, '2'));

                        Onyx.merge(`${ONYXKEYS.COLLECTION.TEST_KEY}3`, {name: 'c'});

                        await screen.findByText(dataMatcher(ONYXKEYS.COLLECTION.TEST_KEY, '3'));
                    },
                    afterEach: clearOnyxAfterEachMeasure,
                },
            );
        });

        /**
         * Expected renders: 1.
         *
         * Changing a member the selector does not read must be deduped by the selector's output equality.
         */
        test('changing a member the selector ignores does not re-render', async () => {
            const member1NameSelector = ((collection: OnyxEntry<Record<string, {name: string}>>) => collection?.[`${ONYXKEYS.COLLECTION.TEST_KEY}1`]?.name) as UseOnyxSelector<
                OnyxKey,
                string
            >;
            await measureRenders(
                <UseOnyxWrapper
                    onyxKey={ONYXKEYS.COLLECTION.TEST_KEY}
                    onyxOptions={{selector: member1NameSelector}}
                />,
                {
                    beforeEach: async () => {
                        await Onyx.mergeCollection(ONYXKEYS.COLLECTION.TEST_KEY, {[`${ONYXKEYS.COLLECTION.TEST_KEY}1`]: {name: 'a'}, [`${ONYXKEYS.COLLECTION.TEST_KEY}2`]: {name: 'b'}});
                    },
                    scenario: async () => {
                        await screen.findByText(dataMatcher(ONYXKEYS.COLLECTION.TEST_KEY, 'a'));

                        Onyx.merge(`${ONYXKEYS.COLLECTION.TEST_KEY}2`, {name: 'b2'});

                        await screen.findByText(dataMatcher(ONYXKEYS.COLLECTION.TEST_KEY, 'a'));
                    },
                    afterEach: clearOnyxAfterEachMeasure,
                },
            );
        });

        /**
         * Expected renders: 1.
         *
         * Large list of members, each subscribing to its own collection member key, with a single member
         * updated.
         */
        test('large list of members, single member update', async () => {
            const SCALE = 100;

            function ScaledItem({index}: {index: number}) {
                const [data] = useOnyx(`${ONYXKEYS.COLLECTION.TEST_KEY}${index}` as OnyxKey);
                return <Text>{`item_${index}_${JSON.stringify(data)}`}</Text>;
            }

            function ScaledList() {
                return (
                    <View>
                        {Array.from({length: SCALE}, (_, index) => (
                            <ScaledItem
                                key={index}
                                index={index}
                            />
                        ))}
                    </View>
                );
            }

            await measureRenders(<ScaledList />, {
                beforeEach: async () => {
                    const collection = Object.fromEntries(Array.from({length: SCALE}, (_, index) => [`${ONYXKEYS.COLLECTION.TEST_KEY}${index}`, {name: `n${index}`}]));
                    await Onyx.mergeCollection(ONYXKEYS.COLLECTION.TEST_KEY, collection);
                },
                scenario: async () => {
                    await screen.findByText(`item_0_${JSON.stringify({name: 'n0'})}`);

                    Onyx.merge(`${ONYXKEYS.COLLECTION.TEST_KEY}1`, {name: 'changed'});

                    await screen.findByText(`item_1_${JSON.stringify({name: 'changed'})}`);
                },
                afterEach: clearOnyxAfterEachMeasure,
            });
        });
    });
});
