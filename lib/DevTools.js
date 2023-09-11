import _ from 'underscore';

const {connectViaExtension} = process.env.NODE_ENV === 'production' ? require('remotedev') : {
    connectViaExtension: () => ({
        init: () => {},
        send: () => {},
    }),
};

class DevTools {
    /**
     * @callback onStateChange
     * @param {object} state
     */
    /**
     * Creates an instance of DevTools, with an internal state that mirrors the storage.
     *
     * @param {object} initialState - initial state of the storage
     * @param {onStateChange} onStateChange - callback which is triggered when we timetravel to a different registered action
     */
    constructor(initialState = {}) {
        this.state = initialState;
        this.remotedev = connectViaExtension();
        this.remotedev.init(this.state);
    }

    /**
     * Registers an action that updated the current state of the storage
     *
     * @param {string} type - name of the action
     * @param {any} payload - data written to the storage
     * @param {object} stateChanges - partial state that got updated after the changes
     */
    registerAction(type, payload = undefined, stateChanges = {}) {
        const newState = {
            ...this.state,
            ...stateChanges,
        };

        this.remotedev.send({type, payload}, newState);
        this.state = newState;
    }

    /**
     * This clears the internal state of the DevTools, preserving the keys not included in `keyToBeRemoved`
     *
     * @param {string[]} keysToBeRemoved
     */
    clearState(keysToBeRemoved = []) {
        const pairs = _.map(keysToBeRemoved, key => [key, undefined]);
        this.registerAction('CLEAR', undefined, _.object(pairs));
    }
}

export default DevTools;
