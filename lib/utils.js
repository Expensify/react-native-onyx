import * as _ from 'underscore';

function areObjectsEmpty(a, b) {
    return (
        typeof a === 'object'
        && typeof b === 'object'
        && _.values(a).length === 0
        && _.values(b).length === 0
    );
}

export default {areObjectsEmpty};
