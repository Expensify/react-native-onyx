import {
    set,
    keys,
    getMany,
    setMany,
    get,
    clear,
    del,
    delMany,
    createStore,
    promisifyRequest,
} from 'idb-keyval';
import _ from 'underscore';
import fastMerge from '../../fastMerge';

// Same config as localforage, so we can swap the providers easily
const customStore = createStore('OnyxDB', 'keyvaluepairs');

const provider = {
    getAllKeys: () => keys(customStore),

    multiGet: keysParam => getMany(keysParam, customStore)
        .then(values => _.map(values, (value, index) => [keysParam[index], value])),

    getItem: key => get(key, customStore),

    multiSet: pairs => setMany(pairs, customStore),

    setItem: (key, value) => set(key, value, customStore),

    multiMerge: pairs => customStore('readwrite', (store) => {
        const getValues = Promise.all(_.map(pairs, ([key]) => promisifyRequest(store.get(key))));

        return getValues.then((values) => {
            const upsertMany = _.map(pairs, ([key, value], index) => {
                const prev = values[index];
                const newValue = _.isObject(prev) ? fastMerge(prev, value) : value;
                return promisifyRequest(store.put(newValue, key));
            });
            return Promise.all(upsertMany);
        });
    }),

    mergeItem(key, _changes, modifiedData) {
        return provider.multiMerge([[key, modifiedData]]);
    },

    clear: () => clear(customStore),

    removeItem: key => del(key, customStore),

    removeItems: keysParam => delMany(keysParam, customStore),
};

export default provider;
