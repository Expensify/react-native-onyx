import {measureFunction} from 'reassure';
import utils from '../../lib/utils';
import {PersonalDetailsMock, createCollection, createPersonalDetails} from '../utils/createCollection';

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

        await measureFunction(async () => utils.fastMerge(target, source, true));
    });
});
