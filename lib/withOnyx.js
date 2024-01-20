/**
 * This is a higher order component that provides the ability to map a state property directly to
 * something in Onyx (a key/value store). That way, as soon as data in Onyx changes, the state will be set and the view
 * will automatically change to reflect the new data.
 */
import PropTypes from 'prop-types';
import React from 'react';
import _ from 'underscore';
import Onyx from './Onyx';
import * as Str from './Str';
import utils from './utils';

// This is a list of keys that can exist on a `mapping`, but are not directly related to loading data from Onyx. When the keys of a mapping are looped over to check
// if a key has changed, it's a good idea to skip looking at these properties since they would have unexpected results.
const mappingPropertiesToIgnoreChangesTo = ['initialValue', 'allowStaleData'];

/**
 * Returns the display name of a component
 *
 * @param {object} component
 * @returns {string}
 */
function getDisplayName(component) {
    return component.displayName || component.name || 'Component';
}

/**
 * Removes all the keys from state that are unrelated to the onyx data being mapped to the component.
 *
 * @param {Object} state of the component
 * @param {Object} onyxToStateMapping the object holding all of the mapping configuration for the component
 * @returns {Object}
 */
const getOnyxDataFromState = (state, onyxToStateMapping) => _.pick(state, _.keys(onyxToStateMapping));

export default function (mapOnyxToState, shouldDelayUpdates = false) {
    // A list of keys that must be present in tempState before we can render the WrappedComponent
    const requiredKeysForInit = _.chain(mapOnyxToState)
        .omit((config) => config.initWithStoredValues === false)
        .keys()
        .value();
    return (WrappedComponent) => {
        const displayName = getDisplayName(WrappedComponent);
        class withOnyx extends React.Component {
            pendingSetStates = [];

            constructor(props) {
                super(props);
                this.shouldDelayUpdates = shouldDelayUpdates;
                this.setWithOnyxState = this.setWithOnyxState.bind(this);
                this.flushPendingSetStates = this.flushPendingSetStates.bind(this);

                // This stores all the Onyx connection IDs to be used when the component unmounts so everything can be
                // disconnected. It is a key value store with the format {[mapping.key]: connectionID}.
                this.activeConnectionIDs = {};

                const cachedState = _.reduce(
                    mapOnyxToState,
                    (resultObj, mapping, propertyName) => {
                        const key = Str.result(mapping.key, props);
                        let value = Onyx.tryGetCachedValue(key, mapping);
                        if (!value && mapping.initialValue) {
                            value = mapping.initialValue;
                        }

                        /**
                         * If we have a pending merge for a key it could mean that data is being set via Onyx.merge() and someone expects a component to have this data immediately.
                         *
                         * @example
                         *
                         * Onyx.merge('report_123', value);
                         * Navigation.navigate(route); // Where "route" expects the "value" to be available immediately once rendered.
                         *
                         * In reality, Onyx.merge() will only update the subscriber after all merges have been batched and the previous value is retrieved via a get() (returns a promise).
                         * So, we won't use the cache optimization here as it will lead us to arbitrarily defer various actions in the application code.
                         */
                        if ((value !== undefined && !Onyx.hasPendingMergeForKey(key)) || mapping.allowStaleData) {
                            // eslint-disable-next-line no-param-reassign
                            resultObj[propertyName] = value;
                        }

                        return resultObj;
                    },
                    {},
                );

                // If we have all the data we need, then we can render the component immediately
                cachedState.loading = _.size(cachedState) < requiredKeysForInit.length;

                // Object holding the temporary initial state for the component while we load the various Onyx keys
                this.tempState = cachedState;

                this.state = cachedState;
            }

            componentDidMount() {
                const onyxDataFromState = getOnyxDataFromState(this.state, mapOnyxToState);

                // Subscribe each of the state properties to the proper Onyx key
                _.each(mapOnyxToState, (mapping, propertyName) => {
                    if (_.includes(mappingPropertiesToIgnoreChangesTo, propertyName)) {
                        return;
                    }
                    const key = Str.result(mapping.key, {...this.props, ...onyxDataFromState});
                    this.connectMappingToOnyx(mapping, propertyName, key);
                });
                this.checkEvictableKeys();
            }

            componentDidUpdate(prevProps, prevState) {
                // The whole purpose of this method is to check to see if a key that is subscribed to Onyx has changed, and then Onyx needs to be disconnected from the old
                // key and connected to the new key.
                // For example, a key could change if KeyB depends on data loading from Onyx for KeyA.
                const isFirstTimeUpdatingAfterLoading = prevState.loading && !this.state.loading;
                const onyxDataFromState = getOnyxDataFromState(this.state, mapOnyxToState);
                const prevOnyxDataFromState = getOnyxDataFromState(prevState, mapOnyxToState);

                _.each(mapOnyxToState, (mapping, propName) => {
                    // Some properties can be ignored because they aren't related to onyx keys and they will never change
                    if (_.includes(mappingPropertiesToIgnoreChangesTo, propName)) {
                        return;
                    }

                    // The previous key comes from either:
                    // 1) The initial key that was connected to (ie. set from `componentDidMount()`)
                    // 2) The updated props which caused `componentDidUpdate()` to run
                    // The first case cannot be used all the time because of race conditions where `componentDidUpdate()` can be triggered before connectingMappingToOnyx() is done
                    // (eg. if a user switches chats really quickly). In this case, it's much more stable to always look at the changes to prevProp and prevState to derive the key.
                    // The second case cannot be used all the time because the onyx data doesn't change the first time that `componentDidUpdate()` runs after loading. In this case,
                    // the `mapping.previousKey` must be used for the comparison or else this logic never detects that onyx data could have changed during the loading process.
                    const previousKey = Onyx.getCacheKey(isFirstTimeUpdatingAfterLoading ? mapping.previousKey : Str.result(mapping.key, {...prevProps, ...prevOnyxDataFromState}));
                    const newKey = Onyx.getCacheKey(Str.result(mapping.key, {...this.props, ...onyxDataFromState}));
                    if (previousKey !== newKey) {
                        Onyx.disconnect(this.activeConnectionIDs[previousKey], previousKey);
                        delete this.activeConnectionIDs[previousKey];
                        this.connectMappingToOnyx(mapping, propName, newKey);
                    }
                });
                this.checkEvictableKeys();
            }

            componentWillUnmount() {
                // Disconnect everything from Onyx
                _.each(mapOnyxToState, (mapping) => {
                    const key = Str.result(mapping.key, {...this.props, ...getOnyxDataFromState(this.state, mapOnyxToState)});
                    Onyx.disconnect(this.activeConnectionIDs[key], key);
                });
            }

            setStateProxy(modifier) {
                if (this.shouldDelayUpdates) {
                    this.pendingSetStates.push(modifier);
                } else {
                    this.setState(modifier);
                }
            }

            /**
             * This method is used by the internal raw Onyx `sendDataToConnection`, it is designed to prevent unnecessary renders while a component
             * still in a "loading" (read "mounting") state. The temporary initial state is saved to the HOC instance and setState()
             * only called once all the necessary data has been collected.
             *
             * There is however the possibility the component could have been updated by a call to setState()
             * before the data was "initially" collected. A race condition.
             * For example some update happened on some key, while onyx was still gathering the initial hydration data.
             * This update is disptached directly to setStateProxy and therefore the component has the most up-to-date data
             *
             * This is a design flaw in Onyx itself as dispatching updates before initial hydration is not a correct event flow.
             * We however need to workaround this issue in the HOC. The addition of initialValue makes things even more complex,
             * since you cannot be really sure if the component has been updated before or after the initial hydration. Therefore if
             * initialValue is there, we just check if the update is different than that and then try to handle it as best as we can.
             *
             * @param {String} statePropertyName
             * @param {*} val
             */
            setWithOnyxState(statePropertyName, val) {
                const prevValue = this.state[statePropertyName];

                // If the component is not loading (read "mounting"), then we can just update the state
                // There is a small race condition.
                // When calling setWithOnyxState we delete the tempState object that is used to hold temporary state updates while the HOC is gathering data.
                // However the loading flag is only set on the setState callback down below. setState however is an async operation that is also batched,
                // therefore there is a small window of time where the loading flag is not false but the tempState is already gone
                // (while the update is queued and waiting to be applied).
                // This simply bypasses the loading check if the tempState is gone and the update can be safely queued with a normal setStateProxy.
                if (!this.state.loading || !this.tempState) {
                    // Performance optimization, do not trigger update with same values
                    if (prevValue === val || utils.areObjectsEmpty(prevValue, val)) {
                        return;
                    }

                    this.setStateProxy({[statePropertyName]: val});
                    return;
                }

                this.tempState[statePropertyName] = val;

                // If some key does not have a value yet, do not update the state yet
                const tempStateIsMissingKey = _.some(requiredKeysForInit, (key) => _.isUndefined(this.tempState[key]));
                if (tempStateIsMissingKey) {
                    return;
                }

                const stateUpdate = {...this.tempState};
                delete this.tempState;

                // Full of hacky workarounds to prevent the race condition described above.
                this.setState((prevState) => {
                    const finalState = _.reduce(
                        stateUpdate,
                        (result, value, key) => {
                            if (key === 'loading') {
                                return result;
                            }

                            const initialValue = mapOnyxToState[key].initialValue;

                            // If initialValue is there and the state contains something different it means
                            // an update has already been received and we can discard the value we are trying to hydrate
                            if (!_.isUndefined(initialValue) && !_.isUndefined(prevState[key]) && prevState[key] !== initialValue) {
                                // eslint-disable-next-line no-param-reassign
                                result[key] = prevState[key];

                                // if value is already there (without initial value) then we can discard the value we are trying to hydrate
                            } else if (!_.isUndefined(prevState[key])) {
                                // eslint-disable-next-line no-param-reassign
                                result[key] = prevState[key];
                            } else {
                                // eslint-disable-next-line no-param-reassign
                                result[key] = value;
                            }
                            return result;
                        },
                        {},
                    );

                    finalState.loading = false;
                    return finalState;
                });
            }

            /**
             * Makes sure each Onyx key we requested has been set to state with a value of some kind.
             * We are doing this so that the wrapped component will only render when all the data
             * it needs is available to it.
             */
            checkEvictableKeys() {
                // We will add this key to our list of recently accessed keys
                // if the canEvict function returns true. This is necessary criteria
                // we MUST use to specify if a key can be removed or not.
                _.each(mapOnyxToState, (mapping) => {
                    if (_.isUndefined(mapping.canEvict)) {
                        return;
                    }

                    const canEvict = Str.result(mapping.canEvict, this.props);
                    const key = Str.result(mapping.key, this.props);

                    if (!Onyx.isSafeEvictionKey(key)) {
                        throw new Error(`canEvict can't be used on key '${key}'. This key must explicitly be flagged as safe for removal by adding it to Onyx.init({safeEvictionKeys: []}).`);
                    }

                    if (canEvict) {
                        Onyx.removeFromEvictionBlockList(key, mapping.connectionID);
                    } else {
                        Onyx.addToEvictionBlockList(key, mapping.connectionID);
                    }
                });
            }

            /**
             * Takes a single mapping and binds the state of the component to the store
             *
             * @param {object} mapping
             * @param {string|function} mapping.key key to connect to. can be a string or a
             * function that takes this.props as an argument and returns a string
             * @param {string} statePropertyName the name of the state property that Onyx will add the data to
             * @param {boolean} [mapping.initWithStoredValues] If set to false, then no data will be prefilled into the
             *  component
             * @param {string} key to connect to Onyx with
             */
            connectMappingToOnyx(mapping, statePropertyName, key) {
                // Remember what the previous key was so that key changes can be detected when data is being loaded from Onyx. This will allow
                // dependent keys to finish loading their data.
                // eslint-disable-next-line no-param-reassign
                mapOnyxToState[statePropertyName].previousKey = key;

                // eslint-disable-next-line rulesdir/prefer-onyx-connect-in-libs
                this.activeConnectionIDs[key] = Onyx.connect({
                    ...mapping,
                    key,
                    statePropertyName,
                    withOnyxInstance: this,
                    displayName,
                });
            }

            flushPendingSetStates() {
                if (!this.shouldDelayUpdates) {
                    return;
                }

                this.shouldDelayUpdates = false;

                this.pendingSetStates.forEach((modifier) => {
                    this.setState(modifier);
                });
                this.pendingSetStates = [];
            }

            render() {
                // Remove any null values so that React replaces them with default props
                const propsToPass = _.omit(this.props, _.isNull);

                if (this.state.loading) {
                    return null;
                }

                // Remove any internal state properties used by withOnyx
                // that should not be passed to a wrapped component
                let stateToPass = _.omit(this.state, 'loading');
                stateToPass = _.omit(stateToPass, _.isNull);

                // Spreading props and state is necessary in an HOC where the data cannot be predicted
                return (
                    <WrappedComponent
                        markReadyForHydration={this.flushPendingSetStates}
                        // eslint-disable-next-line react/jsx-props-no-spreading
                        {...propsToPass}
                        // eslint-disable-next-line react/jsx-props-no-spreading
                        {...stateToPass}
                        ref={this.props.forwardedRef}
                    />
                );
            }
        }

        withOnyx.propTypes = {
            forwardedRef: PropTypes.oneOfType([
                PropTypes.func,
                // eslint-disable-next-line react/forbid-prop-types
                PropTypes.shape({current: PropTypes.object}),
            ]),
        };
        withOnyx.defaultProps = {
            forwardedRef: undefined,
        };
        withOnyx.displayName = `withOnyx(${displayName})`;
        return React.forwardRef((props, ref) => {
            const Component = withOnyx;
            return (
                <Component
                    // eslint-disable-next-line react/jsx-props-no-spreading
                    {...props}
                    forwardedRef={ref}
                />
            );
        });
    };
}
