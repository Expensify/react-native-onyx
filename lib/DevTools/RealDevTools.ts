import type {IDevTools, DevtoolsOptions, DevtoolsConnection, ReduxDevtools} from './types';

const ERROR_LABEL = 'Onyx DevTools - Error: ';

/**
 * Real implementation of DevTools that connects to Redux DevTools Extension
 */
class RealDevTools implements IDevTools {
    private remoteDev?: DevtoolsConnection;

    private state: Record<string, unknown>;

    private defaultState: Record<string, unknown>;

    constructor() {
        this.remoteDev = this.connectViaExtension();
        this.state = {};
        this.defaultState = {};
    }

    connectViaExtension(options?: DevtoolsOptions): DevtoolsConnection | undefined {
        try {
            // We don't want to augment the window type in a library code, so we use type assertion instead
            // eslint-disable-next-line no-underscore-dangle, @typescript-eslint/no-explicit-any
            const reduxDevtools: ReduxDevtools = typeof window === 'undefined' ? undefined : (window as any).__REDUX_DEVTOOLS_EXTENSION__;

            if (options?.remote || !reduxDevtools) {
                return;
            }

            return reduxDevtools.connect(options);
        } catch (e) {
            console.error(ERROR_LABEL, e);
        }
    }

    /**
     * Registers an action that updated the current state of the storage
     *
     * @param type - name of the action
     * @param payload - data written to the storage
     * @param stateChanges - partial state that got updated after the changes
     */
    registerAction(type: string, payload: unknown, stateChanges: Record<string, unknown> | null = {}) {
        try {
            if (!this.remoteDev) {
                return;
            }
            const newState = {
                ...this.state,
                ...stateChanges,
            };
            this.remoteDev.send({type, payload}, newState);
            this.state = newState;
        } catch (e) {
            console.error(ERROR_LABEL, e);
        }
    }

    initState(initialState: Record<string, unknown> = {}) {
        try {
            if (!this.remoteDev) {
                return;
            }
            this.remoteDev.init(initialState);
            this.state = initialState;
            this.defaultState = initialState;
        } catch (e) {
            console.error(ERROR_LABEL, e);
        }
    }

    /**
     * This clears the internal state of the DevTools, preserving the keys included in `keysToPreserve`
     */
    clearState(keysToPreserve: string[] = []): void {
        const newState = Object.entries(this.state).reduce((obj: Record<string, unknown>, [key, value]) => {
            // eslint-disable-next-line no-param-reassign
            obj[key] = keysToPreserve.includes(key) ? value : this.defaultState[key];
            return obj;
        }, {});

        this.registerAction('CLEAR', undefined, newState);
    }
}

export default RealDevTools;
