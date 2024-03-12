import NOOP from 'lodash/noop';

/**
 *  This is used to keep multiple browser tabs in sync, therefore only needed on web
 *  On native platforms, we omit this syncing logic by setting this to mock implementation.
 */
const InstanceSync = {
    shouldBeUsed: false,
    init: NOOP,
    setItem: NOOP,
    removeItem: NOOP,
    removeItems: NOOP,
    mergeItem: NOOP,
    clear: <T extends () => void>(callback: T) => Promise.resolve(callback()),
};

export default InstanceSync;
