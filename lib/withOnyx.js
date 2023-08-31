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

/**
 * Returns the display name of a component
 *
 * @param {object} component
 * @returns {string}
 */
function getDisplayName(component) {
    return component.displayName || component.name || 'Component';
}

export default function (mapOnyxToState) {
    // A list of keys that must be present in tempState before we can render the WrappedComponent
    const requiredKeysForInit = _.chain(mapOnyxToState)
        .omit(config => config.initWithStoredValues === false)
        .keys()
        .value();
    return (WrappedComponent) => {
        const displayName = getDisplayName(WrappedComponent);
        class withOnyx extends React.Component {
            constructor(props) {
                super(props);

                this.setWithOnyxState = this.setWithOnyxState.bind(this);

                // This stores all the Onyx connection IDs to be used when the component unmounts so everything can be
                // disconnected. It is a key value store with the format {[mapping.key]: connectionID}.
                this.activeConnectionIDs = {};

                const cachedState = _.reduce(mapOnyxToState, (resultObj, mapping, propertyName) => {
                    const key = Str.result(mapping.key, props);
                    const value = Onyx.tryGetCachedValue(key, mapping);

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
                    if (value !== undefined && !Onyx.hasPendingMergeForKey(key)) {
                        // eslint-disable-next-line no-param-reassign
                        resultObj[propertyName] = value;
                    }

                    return resultObj;
                }, {});

                // If we have all the data we need, then we can render the component immediately
                cachedState.loading = _.size(cachedState) < requiredKeysForInit.length;

                // Object holding the temporary initial state for the component while we load the various Onyx keys
                this.tempState = cachedState;

                this.state = cachedState;
            }

            componentDidMount() {
                // Subscribe each of the state properties to the proper Onyx key
                _.each(mapOnyxToState, (mapping, propertyName) => {
                    this.connectMappingToOnyx(mapping, propertyName);
                });
                this.checkEvictableKeys();
            }

            componentDidUpdate(prevProps) {
                // If any of the mappings use data from the props, then when the props change, all the
                // connections need to be reconnected with the new props
                _.each(mapOnyxToState, (mapping, propertyName) => {
                    const previousKey = Str.result(mapping.key, prevProps);
                    const newKey = Str.result(mapping.key, this.props);
                    if (previousKey !== newKey) {
                        Onyx.disconnect(this.activeConnectionIDs[previousKey], previousKey);
                        delete this.activeConnectionIDs[previousKey];
                        this.connectMappingToOnyx(mapping, propertyName);
                    }
                });
                this.checkEvictableKeys();
            }

            componentWillUnmount() {
                // Disconnect everything from Onyx
                _.each(mapOnyxToState, (mapping) => {
                    const key = Str.result(mapping.key, this.props);
                    const connectionID = this.activeConnectionIDs[key];
                    Onyx.disconnect(connectionID, key);
                });
            }

            /**
             * This method is used externally by sendDataToConnection to prevent unnecessary renders while a component
             * still in a loading state. The temporary initial state is saved to the component instance and setState()
             * only called once all the necessary data has been collected.
             *
             * @param {String} statePropertyName
             * @param {*} val
             */
            setWithOnyxState(statePropertyName, val) {
                // We might have loaded the values for the onyx keys/mappings already from the cache.
                // In case we were able to load all the values upfront, the loading state will be false.
                // However, Onyx.js will always call setWithOnyxState, as it doesn't know that this implementation
                // already loaded the values from cache. Thus we have to check whether the value has changed
                // before we set the state to prevent unnecessary renders.
                const prevValue = this.state[statePropertyName];
                if (!this.state.loading && prevValue === val) {
                    return;
                }

                if (!this.state.loading) {
                    this.setState({[statePropertyName]: val});
                    return;
                }

                this.tempState[statePropertyName] = val;

                // All state keys should exist and at least have a value of null
                if (_.some(requiredKeysForInit, key => _.isUndefined(this.tempState[key]))) {
                    return;
                }

                // Leave untouched previous state to avoid data loss during pre-load updates.
                // This handles case when setState was called before the setWithOnyxState.
                // For example, when an Onyx property was updated by keyChanged before the call of the setWithOnyxState.
                this.setState((prevState) => {
                    const remainingTempState = _.omit(this.tempState, _.keys(prevState));

                    return ({...remainingTempState, loading: false});
                });

                delete this.tempState;
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
             */
            connectMappingToOnyx(mapping, statePropertyName) {
                const key = Str.result(mapping.key, this.props);

                // eslint-disable-next-line rulesdir/prefer-onyx-connect-in-libs
                this.activeConnectionIDs[key] = Onyx.connect({
                    ...mapping,
                    key,
                    statePropertyName,
                    withOnyxInstance: this,
                    displayName,
                });
            }

            render() {
                if (this.state.loading) {
                    return null;
                }

                // Remove any internal state properties used by withOnyx
                // that should not be passed to a wrapped component
                let stateToPass = _.omit(this.state, 'loading');
                stateToPass = _.omit(stateToPass, value => _.isNull(value));

                // Remove any null values so that React replaces them with default props
                const propsToPass = _.omit(this.props, value => _.isNull(value));

                // Spreading props and state is necessary in an HOC where the data cannot be predicted
                return (
                    <WrappedComponent
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
            // eslint-disable-next-line react/jsx-props-no-spreading
            return <Component {...props} forwardedRef={ref} />;
        });
    };
}
