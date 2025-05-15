import {measureFunction} from 'reassure';
import utils from '../../lib/utils';
import {createCollection, createPersonalDetails} from '../utils/createCollection';
import type {PersonalDetailsMock} from '../utils/createCollection';

const getMockedPersonalDetails = (length = 10) =>
    createCollection<PersonalDetailsMock>(
        (item) => item.accountID,
        (index) => createPersonalDetails(index),
        length,
    );

describe('[Utils.js]', () => {
    test('fastMerge', async () => {
        const target = getMockedPersonalDetails(1000);
        const source = getMockedPersonalDetails(500);

        await measureFunction(() =>
            utils.fastMerge(target, source, {
                shouldRemoveNestedNulls: true,
                shouldReplaceMarkedObjects: true,
            }),
        );
    });
});
