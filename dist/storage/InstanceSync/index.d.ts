/**
 *  This is used to keep multiple browser tabs in sync, therefore only needed on web
 *  On native platforms, we omit this syncing logic by setting this to mock implementation.
 */
declare const InstanceSync: {
    shouldBeUsed: boolean;
    init: (...args: any[]) => void;
    setItem: (...args: any[]) => void;
    removeItem: (...args: any[]) => void;
    removeItems: (...args: any[]) => void;
    multiMerge: (...args: any[]) => void;
    multiSet: (...args: any[]) => void;
    mergeItem: (...args: any[]) => void;
    clear: <T extends () => void>(callback: T) => Promise<void>;
};
export default InstanceSync;
