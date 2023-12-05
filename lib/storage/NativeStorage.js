import SQLiteStorage from './providers/SQLiteStorage';

const webStorage = {
    ...SQLiteStorage,

    /**
     * Noop on native
     */
    keepInstancesSync() {},
};

export default webStorage;
