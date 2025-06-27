import {randAggregation, randBoolean, randWord} from '@ngneat/falso';
import {format} from 'date-fns';
import {createCollection} from './createCollection';
import type {GenericDeepRecord} from '../../../lib/types';

const getRandomDate = (): string => {
    const randomTimestamp = Math.random() * new Date().getTime();
    const randomDate = new Date(randomTimestamp);

    const formattedDate = format(randomDate, 'yyyy-MM-dd HH:mm:ss.SSS');

    return formattedDate;
};

const getRandomReportActions = (collection: string, length = 10000) =>
    createCollection<Record<string, unknown>>(
        (item) => `${collection}${item.reportActionID}`,
        (index) => createRandomReportAction(index),
        length,
    );

export default function createRandomReportAction(index: number): GenericDeepRecord {
    return {
        actionName: randWord(),
        reportActionID: index.toString(),
        actorAccountID: index,
        person: [
            {
                type: randWord(),
                style: randWord(),
                text: randWord(),
            },
        ],
        created: getRandomDate(),
        message: [
            {
                type: randWord(),
                html: randWord(),
                style: randWord(),
                text: randWord(),
                isEdited: randBoolean(),
                isDeletedParentAction: randBoolean(),
                whisperedTo: randAggregation(),
            },
        ],
        originalMessage: {
            html: randWord(),
            lastModified: getRandomDate(),
            whisperedTo: randAggregation(),
        },
        avatar: randWord(),
        automatic: randBoolean(),
        shouldShow: randBoolean(),
        lastModified: getRandomDate(),
        pendingAction: randWord(),
        delegateAccountID: index,
        errors: {},
        isAttachmentOnly: randBoolean(),
    };
}

export {getRandomDate, getRandomReportActions};
