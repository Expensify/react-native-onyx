import SQLiteProvider from '../providers/SQLiteProvider';

const webStorage = {
    ...SQLiteProvider,

    /**
     * Noop on native
     */
    keepInstancesSync() {},
};

export default webStorage;
