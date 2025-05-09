import {measureFunction} from 'reassure';
import Onyx from '../../lib';
import type {OnyxKey, WithOnyxConnectOptions} from '../../lib/types';
import utils from '../../lib/utils';
import createRandomReportAction, {getRandomReportActions} from '../utils/collections/reportActions';
import generateEmptyWithOnyxInstance from '../utils/generateEmptyWithOnyxInstance';

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
            await measureFunction(() => utils.fastMerge(target, source));
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

    describe('hasWithOnyxInstance', () => {
        test('one call', async () => {
            const options: WithOnyxConnectOptions<OnyxKey> = {
                displayName: '',
                key: '',
                statePropertyName: '',
                withOnyxInstance: generateEmptyWithOnyxInstance(),
            };
            await measureFunction(() => utils.hasWithOnyxInstance(options));
        });
    });
});
