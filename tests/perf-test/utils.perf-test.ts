import {measureFunction} from 'reassure';
import Onyx from '../../lib';
import utils from '../../lib/utils';
import createRandomReportAction, {getRandomReportActions} from '../utils/collections/reportActions';
import {createObjectArray, createObjectArrayCollection} from '../utils/collections/objectArrays';

const ONYXKEYS = {
    COLLECTION: {
        TEST_KEY: 'test_',
    },
};

const collectionKey = ONYXKEYS.COLLECTION.TEST_KEY;

describe('utils', () => {
    describe('isEmptyObject', () => {
        test('one call with one heavy object', async () => {
            const reportAction = createRandomReportAction(0);
            await measureFunction(() => utils.isEmptyObject(reportAction));
        });
    });

    describe('fastMerge', () => {
        test('one call', async () => {
            const target = getRandomReportActions(collectionKey, 1000);
            const source = getRandomReportActions(collectionKey, 500);
            await measureFunction(() =>
                utils.fastMerge(target, source, {
                    shouldRemoveNestedNulls: true,
                }),
            );
        });
    });

    describe('fastMerge collection of arrays', () => {
        const COLLECTION_SIZE = 1500;

        const createCollection = (createMember?: typeof createObjectArray) => createObjectArrayCollection(collectionKey, COLLECTION_SIZE, createMember);

        // Merges every member separately, like OnyxCache.merge() does.
        const mergeCollection = (target: Record<string, unknown[]>, source: Record<string, unknown[]>) => {
            for (const key of Object.keys(source)) {
                utils.fastMerge(target[key], source[key], {shouldRemoveNestedNulls: true, objectRemovalMode: 'replace', shouldKeepEqualArrays: true});
            }
        };

        const target = createCollection();

        test('all members deep-equal', async () => {
            const source = createCollection();
            await measureFunction(() => mergeCollection(target, source));
        });

        test('one member different', async () => {
            const source = createCollection((index) => createObjectArray(index, undefined, index === 0 ? 0 : undefined));
            await measureFunction(() => mergeCollection(target, source));
        });

        test('all members different in the first element', async () => {
            const source = createCollection((index) => createObjectArray(index, undefined, 0));
            await measureFunction(() => mergeCollection(target, source));
        });

        test('all members different in the last element', async () => {
            const source = createCollection((index) => createObjectArray(index, undefined, index % 3));
            await measureFunction(() => mergeCollection(target, source));
        });

        test('all members long and different only in the first element', async () => {
            const longTarget = createCollection((index) => createObjectArray(index, 50));
            const source = createCollection((index) => createObjectArray(index, 50, 0));
            await measureFunction(() => mergeCollection(longTarget, source));
        });

        test('all members long and different only in the last element', async () => {
            const longTarget = createCollection((index) => createObjectArray(index, 50));
            const source = createCollection((index) => createObjectArray(index, 50, 49));
            await measureFunction(() => mergeCollection(longTarget, source));
        });
    });

    describe('formatActionName', () => {
        test('one call', async () => {
            await measureFunction(() => utils.formatActionName(Onyx.METHOD.SET, ONYXKEYS.COLLECTION.TEST_KEY));
        });
    });

    describe('removeNestedNullValues', () => {
        test('one call', async () => {
            const reportAction = createRandomReportAction(0);
            reportAction.actorAccountID = null;
            reportAction.person.push(null);
            reportAction.message[0].style = null;
            reportAction.originalMessage.whisperedTo = null;
            reportAction.lastModified = null;

            await measureFunction(() => utils.removeNestedNullValues(reportAction));
        });
    });

    describe('checkCompatibilityWithExistingValue', () => {
        test('one call', async () => {
            const value = {};
            const existingValue: unknown[] = [];
            await measureFunction(() => utils.checkCompatibilityWithExistingValue(value, existingValue));
        });
    });

    describe('pick', () => {
        test('one call passing string condition', async () => {
            const reportAction = createRandomReportAction(0);
            await measureFunction(() => utils.pick(reportAction, 'originalMessage'));
        });

        test('one call passing string array condition', async () => {
            const reportAction = createRandomReportAction(0);
            await measureFunction(() => utils.pick(reportAction, ['originalMessage', 'person', 'message']));
        });

        test('one call passing function condition', async () => {
            const reportAction = createRandomReportAction(0);
            await measureFunction(() => utils.pick(reportAction, (entry) => typeof entry[1] === 'boolean'));
        });
    });

    describe('omit', () => {
        test('one call passing string condition', async () => {
            const reportAction = createRandomReportAction(0);
            await measureFunction(() => utils.omit(reportAction, 'originalMessage'));
        });

        test('one call passing string array condition', async () => {
            const reportAction = createRandomReportAction(0);
            await measureFunction(() => utils.omit(reportAction, ['originalMessage', 'person', 'message']));
        });

        test('one call passing function condition', async () => {
            const reportAction = createRandomReportAction(0);
            await measureFunction(() => utils.omit(reportAction, (entry) => typeof entry[1] === 'boolean'));
        });
    });
});
