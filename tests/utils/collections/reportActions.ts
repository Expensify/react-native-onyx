import {randAggregation, randBoolean, randWord} from '@ngneat/falso';
import {format} from 'date-fns';

const getRandomDate = (): string => {
    const randomTimestamp = Math.random() * new Date().getTime();
    const randomDate = new Date(randomTimestamp);

    const formattedDate = format(randomDate, 'yyyy-MM-dd HH:mm:ss.SSS');

    return formattedDate;
};

export default function createRandomReportAction(index: number): Record<string, unknown> {
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

export {getRandomDate};
