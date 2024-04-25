/**
 * This is a higher order component that provides the ability to map a state property directly to
 * something in Onyx (a key/value store). That way, as soon as data in Onyx changes, the state will be set and the view
 * will automatically change to reflect the new data.
 */
import PropTypes from 'prop-types';
import React from 'react';
import type {IsEqual} from 'type-fest';
import _ from 'underscore';
import Onyx from './Onyx';
import OnyxUtils from './OnyxUtils';
import * as Str from './Str';
import type {CollectionKeyBase, ExtractOnyxCollectionValue, KeyValueMapping, OnyxCollection, OnyxEntry, OnyxKey, OnyxValue, Selector, WithOnyxConnectOptions} from './types';
import utils from './utils';

/**
 * Represents the base mapping options between an Onyx key and the component's prop.
 */
type BaseMapping<TComponentProps, TOnyxProps> = {
    canEvict?: boolean | ((props: Omit<TComponentProps, keyof TOnyxProps>) => boolean);
    initWithStoredValues?: boolean;
    allowStaleData?: boolean;
};

type CollectionBaseMapping<TOnyxKey extends CollectionKeyBase> = {
    initialValue?: OnyxCollection<KeyValueMapping[TOnyxKey]>;
};

type EntryBaseMapping<TOnyxKey extends OnyxKey> = {
    initialValue?: OnyxEntry<KeyValueMapping[TOnyxKey]>;
};

/**
 * Represents the string / function `key` mapping option between an Onyx key and the component's prop.
 *
 * If `key` is `string`, the type of the Onyx value that is associated with `key` must match with the type of the component's prop,
 * otherwise an error will be thrown.
 *
 * If `key` is `function`, the return type of `key` function must be a valid Onyx key and the type of the Onyx value associated
 * with `key` must match with the type of the component's prop, otherwise an error will be thrown.
 *
 * @example
 * ```ts
 * // Onyx prop with `string` key
 * onyxProp: {
 *     key: ONYXKEYS.ACCOUNT,
 * },
 *
 * // Onyx prop with `function` key
 * onyxProp: {
 *     key: ({reportId}) => ONYXKEYS.ACCOUNT,
 * },
 * ```
 */
type BaseMappingKey<TComponentProps, TOnyxProps, TOnyxProp extends keyof TOnyxProps, TOnyxKey extends OnyxKey, TOnyxValue> = IsEqual<TOnyxValue, TOnyxProps[TOnyxProp]> extends true
    ? {
          key: TOnyxKey | ((props: Omit<TComponentProps, keyof TOnyxProps> & Partial<TOnyxProps>) => TOnyxKey);
      }
    : never;

/**
 * Represents the string `key` and `selector` mapping options between an Onyx key and the component's prop.
 *
 * The function signature and return type of `selector` must match with the type of the component's prop,
 * otherwise an error will be thrown.
 *
 * @example
 * ```ts
 * // Onyx prop with `string` key and selector
 * onyxProp: {
 *     key: ONYXKEYS.ACCOUNT,
 *     selector: (value: Account | null): string => value?.id ?? '',
 * },
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type BaseMappingStringKeyAndSelector<TComponentProps, TOnyxProps, TReturnType, TOnyxKey extends OnyxKey> = {
    key: TOnyxKey;
    selector: Selector<TOnyxKey, TOnyxProps, TReturnType>;
};

/**
 * Represents the function `key` and `selector` mapping options between an Onyx key and the component's prop.
 *
 * The function signature and return type of `selector` must match with the type of the component's prop,
 * otherwise an error will be thrown.
 *
 * @example
 * ```ts
 * // Onyx prop with `function` key and selector
 * onyxProp: {
 *     key: ({reportId}) => ONYXKEYS.ACCOUNT,
 *     selector: (value: Account | null) => value?.id ?? '',
 * },
 * ```
 */
type BaseMappingFunctionKeyAndSelector<TComponentProps, TOnyxProps, TReturnType, TOnyxKey extends OnyxKey> = {
    key: (props: Omit<TComponentProps, keyof TOnyxProps> & Partial<TOnyxProps>) => TOnyxKey;
    selector: Selector<TOnyxKey, TOnyxProps, TReturnType>;
};

/**
 * Represents the mapping options between an Onyx key and the component's prop with all its possibilities.
 */
type Mapping<TComponentProps, TOnyxProps, TOnyxProp extends keyof TOnyxProps, TOnyxKey extends OnyxKey> = BaseMapping<TComponentProps, TOnyxProps> &
    EntryBaseMapping<TOnyxKey> &
    (
        | BaseMappingKey<TComponentProps, TOnyxProps, TOnyxProp, TOnyxKey, OnyxEntry<KeyValueMapping[TOnyxKey]>>
        | BaseMappingStringKeyAndSelector<TComponentProps, TOnyxProps, TOnyxProps[TOnyxProp], TOnyxKey>
        | BaseMappingFunctionKeyAndSelector<TComponentProps, TOnyxProps, TOnyxProps[TOnyxProp], TOnyxKey>
    );

/**
 * Represents the mapping options between an Onyx collection key without suffix and the component's prop with all its possibilities.
 */
type CollectionMapping<TComponentProps, TOnyxProps, TOnyxProp extends keyof TOnyxProps, TOnyxKey extends CollectionKeyBase> = BaseMapping<TComponentProps, TOnyxProps> &
    CollectionBaseMapping<TOnyxKey> &
    (
        | BaseMappingKey<TComponentProps, TOnyxProps, TOnyxProp, TOnyxKey, OnyxCollection<KeyValueMapping[TOnyxKey]>>
        | BaseMappingStringKeyAndSelector<TComponentProps, TOnyxProps, ExtractOnyxCollectionValue<TOnyxProps[TOnyxProp]>, TOnyxKey>
        | BaseMappingFunctionKeyAndSelector<TComponentProps, TOnyxProps, ExtractOnyxCollectionValue<TOnyxProps[TOnyxProp]>, TOnyxKey>
    );

/**
 * Represents an union type of all the possible Onyx key mappings.
 * Each `OnyxPropMapping` will be associated with its respective Onyx key, ensuring different type-safety for each object.
 */
type OnyxPropMapping<TComponentProps, TOnyxProps, TOnyxProp extends keyof TOnyxProps> = {
    [TOnyxKey in OnyxKey]: Mapping<TComponentProps, TOnyxProps, TOnyxProp, TOnyxKey>;
}[OnyxKey];

/**
 * Represents an union type of all the possible Onyx collection keys without suffix mappings.
 * Each `OnyxPropCollectionMapping` will be associated with its respective Onyx key, ensuring different type-safety for each object.
 */
type OnyxPropCollectionMapping<TComponentProps, TOnyxProps, TOnyxProp extends keyof TOnyxProps> = {
    [TOnyxKey in CollectionKeyBase]: CollectionMapping<TComponentProps, TOnyxProps, TOnyxProp, TOnyxKey>;
}[CollectionKeyBase];

type MapOnyxToState<TComponentProps, TOnyxProps> = {
    [TOnyxProp in keyof TOnyxProps]: OnyxPropMapping<TComponentProps, TOnyxProps, TOnyxProp> | OnyxPropCollectionMapping<TComponentProps, TOnyxProps, TOnyxProp>;
};

type WithOnyxProps<TComponentProps, TOnyxProps> = Omit<TComponentProps, keyof TOnyxProps>;

type WithOnyxState<TOnyxProps> = TOnyxProps & {
    loading: boolean;
};

// This is a list of keys that can exist on a `mapping`, but are not directly related to loading data from Onyx. When the keys of a mapping are looped over to check
// if a key has changed, it's a good idea to skip looking at these properties since they would have unexpected results.
const mappingPropertiesToIgnoreChangesTo = ['initialValue', 'allowStaleData'];

/**
 * Returns the display name of a component
 */
function getDisplayName<TComponentProps>(component: React.ComponentType<TComponentProps>): string {
    return component.displayName || component.name || 'Component';
}

/**
 * Removes all the keys from state that are unrelated to the onyx data being mapped to the component.
 *
 * @param state of the component
 * @param onyxToStateMapping the object holding all of the mapping configuration for the component
 */
const getOnyxDataFromState = <TComponentProps, TOnyxProps>(state: WithOnyxState<TOnyxProps>, onyxToStateMapping: MapOnyxToState<TComponentProps, TOnyxProps>) =>
    utils.pick(state, Object.keys(onyxToStateMapping)) as WithOnyxState<TOnyxProps>;

export default function <TComponentProps, TOnyxProps>(
    mapOnyxToState: MapOnyxToState<TComponentProps, TOnyxProps>,
    shouldDelayUpdates = false,
): React.ComponentType<Omit<TComponentProps, keyof TOnyxProps>> {
    // A list of keys that must be present in tempState before we can render the WrappedComponent
    const requiredKeysForInit = utils
        .omit(mapOnyxToState, (entry) => entry[1].initWithStoredValues === false)
        .keys()
        .value();
    // const requiredKeysForInit = _.chain(mapOnyxToState)
    //     .omit((config) => config.initWithStoredValues === false)
    //     .keys()
    //     .value();

    return (WrappedComponent: React.ComponentType<TComponentProps>): React.ComponentType<Omit<TComponentProps, keyof TOnyxProps>> => {
        const displayName = getDisplayName(WrappedComponent);

        class withOnyx extends React.Component<WithOnyxProps<TComponentProps, TOnyxProps>, WithOnyxState<TOnyxProps>> {
            pendingSetStates: Array<Partial<WithOnyxState<TOnyxProps>>> = [];

            shouldDelayUpdates: boolean;

            activeConnectionIDs: Record<string, number>;

            tempState: WithOnyxState<TOnyxProps>;

            constructor(props: WithOnyxProps<TComponentProps, TOnyxProps>) {
                super(props);

                this.shouldDelayUpdates = shouldDelayUpdates;
                this.setWithOnyxState = this.setWithOnyxState.bind(this);
                this.flushPendingSetStates = this.flushPendingSetStates.bind(this);

                // This stores all the Onyx connection IDs to be used when the component unmounts so everything can be
                // disconnected. It is a key value store with the format {[mapping.key]: connectionID}.
                this.activeConnectionIDs = {};

                const cachedState = Object.keys(mapOnyxToState).reduce<WithOnyxState<TOnyxProps>>((resultObj, propName) => {
                    const mapping = mapOnyxToState[propName as keyof TOnyxProps];

                    const key = Str.result(mapping.key, props) as OnyxKey;
                    let value = OnyxUtils.tryGetCachedValue(key, mapping as Partial<WithOnyxConnectOptions<OnyxKey>>) as OnyxValue<OnyxKey>;
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
                    if ((value !== undefined && !OnyxUtils.hasPendingMergeForKey(key)) || mapping.allowStaleData) {
                        // eslint-disable-next-line no-param-reassign
                        resultObj[propName as keyof TOnyxProps] = value;
                    }

                    return resultObj;
                }, {} as WithOnyxState<TOnyxProps>);

                // If we have all the data we need, then we can render the component immediately
                cachedState.loading = _.size(cachedState) < requiredKeysForInit.length;

                // Object holding the temporary initial state for the component while we load the various Onyx keys
                this.tempState = cachedState;

                this.state = cachedState;
            }

            componentDidMount() {
                const onyxDataFromState = getOnyxDataFromState(this.state, mapOnyxToState);

                // Subscribe each of the state properties to the proper Onyx key
                Object.keys(mapOnyxToState).forEach((propName) => {
                    const mapping = mapOnyxToState[propName as keyof TOnyxProps];

                    if (_.includes(mappingPropertiesToIgnoreChangesTo, propName)) {
                        return;
                    }

                    const key = Str.result(mapping.key, {...this.props, ...onyxDataFromState}) as OnyxKey;
                    this.connectMappingToOnyx(mapping, propName as keyof TOnyxProps, key);
                });

                this.checkEvictableKeys();
            }

            componentDidUpdate(prevProps: WithOnyxProps<TComponentProps, TOnyxProps>, prevState: WithOnyxState<TOnyxProps>) {
                // The whole purpose of this method is to check to see if a key that is subscribed to Onyx has changed, and then Onyx needs to be disconnected from the old
                // key and connected to the new key.
                // For example, a key could change if KeyB depends on data loading from Onyx for KeyA.
                const isFirstTimeUpdatingAfterLoading = prevState.loading && !this.state.loading;
                const onyxDataFromState = getOnyxDataFromState(this.state, mapOnyxToState);
                const prevOnyxDataFromState = getOnyxDataFromState(prevState, mapOnyxToState);

                Object.keys(mapOnyxToState).forEach((propName) => {
                    const mapping = mapOnyxToState[propName as keyof TOnyxProps];

                    // Some properties can be ignored because they aren't related to onyx keys and they will never change
                    if (mappingPropertiesToIgnoreChangesTo.includes(propName)) {
                        return;
                    }

                    // The previous key comes from either:
                    // 1) The initial key that was connected to (ie. set from `componentDidMount()`)
                    // 2) The updated props which caused `componentDidUpdate()` to run
                    // The first case cannot be used all the time because of race conditions where `componentDidUpdate()` can be triggered before connectingMappingToOnyx() is done
                    // (eg. if a user switches chats really quickly). In this case, it's much more stable to always look at the changes to prevProp and prevState to derive the key.
                    // The second case cannot be used all the time because the onyx data doesn't change the first time that `componentDidUpdate()` runs after loading. In this case,
                    // the `mapping.previousKey` must be used for the comparison or else this logic never detects that onyx data could have changed during the loading process.
                    const previousKey = (isFirstTimeUpdatingAfterLoading ? mapping.previousKey : Str.result(mapping.key, {...prevProps, ...prevOnyxDataFromState})) as OnyxKey;
                    const newKey = Str.result(mapping.key, {...this.props, ...onyxDataFromState}) as OnyxKey;
                    if (previousKey !== newKey) {
                        Onyx.disconnect(this.activeConnectionIDs[previousKey], previousKey);
                        delete this.activeConnectionIDs[previousKey];
                        this.connectMappingToOnyx(mapping, propName as keyof TOnyxProps, newKey);
                    }
                });

                this.checkEvictableKeys();
            }

            componentWillUnmount() {
                // Disconnect everything from Onyx
                Object.keys(mapOnyxToState).forEach((propName) => {
                    const mapping = mapOnyxToState[propName as keyof TOnyxProps];

                    const key = Str.result(mapping.key, {...this.props, ...getOnyxDataFromState(this.state, mapOnyxToState)}) as OnyxKey;
                    Onyx.disconnect(this.activeConnectionIDs[key], key);
                });
            }

            setStateProxy(modifier: Partial<WithOnyxState<TOnyxProps>>) {
                if (this.shouldDelayUpdates) {
                    this.pendingSetStates.push(modifier);
                } else {
                    this.setState(modifier as WithOnyxState<TOnyxProps>);
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
            setWithOnyxState<T extends keyof TOnyxProps>(statePropertyName: T, val: WithOnyxState<TOnyxProps>[T]) {
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
                    if (prevValue === val || (utils.isEmptyObject(prevValue) && utils.isEmptyObject(val))) {
                        return;
                    }

                    this.setStateProxy({[statePropertyName]: val as WithOnyxState<TOnyxProps>[T]});
                    return;
                }

                this.tempState[statePropertyName] = val;

                // If some key does not have a value yet, do not update the state yet
                const tempStateIsMissingKey = requiredKeysForInit.some((key) => this.tempState[key as keyof TOnyxProps] === undefined);
                if (tempStateIsMissingKey) {
                    return;
                }

                const stateUpdate = {...this.tempState};
                delete this.tempState;

                // Full of hacky workarounds to prevent the race condition described above.
                this.setState((prevState) => {
                    const finalState = Object.keys(stateUpdate).reduce<WithOnyxState<TOnyxProps>>((result, _key) => {
                        const key = _key as keyof TOnyxProps;

                        if (key === 'loading') {
                            return result;
                        }

                        const initialValue = mapOnyxToState[key].initialValue;

                        // If initialValue is there and the state contains something different it means
                        // an update has already been received and we can discard the value we are trying to hydrate
                        if (initialValue !== undefined && prevState[key] !== undefined && prevState[key] !== initialValue) {
                            // eslint-disable-next-line no-param-reassign
                            result[key] = prevState[key];

                            // if value is already there (without initial value) then we can discard the value we are trying to hydrate
                        } else if (!_.isUndefined(prevState[key])) {
                            // eslint-disable-next-line no-param-reassign
                            result[key] = prevState[key];
                        } else {
                            // eslint-disable-next-line no-param-reassign
                            result[key] = stateUpdate[key];
                        }

                        return result;
                    }, {} as WithOnyxState<TOnyxProps>);

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
                Object.keys(mapOnyxToState).forEach((propName) => {
                    const mapping = mapOnyxToState[propName as keyof TOnyxProps];

                    if (mapping.canEvict === undefined) {
                        return;
                    }

                    const canEvict = Str.result(mapping.canEvict, this.props) as boolean;
                    const key = Str.result(mapping.key, this.props) as OnyxKey;

                    if (!OnyxUtils.isSafeEvictionKey(key)) {
                        throw new Error(`canEvict can't be used on key '${key}'. This key must explicitly be flagged as safe for removal by adding it to Onyx.init({safeEvictionKeys: []}).`);
                    }

                    if (canEvict) {
                        OnyxUtils.removeFromEvictionBlockList(key, mapping.connectionID);
                    } else {
                        OnyxUtils.addToEvictionBlockList(key, mapping.connectionID);
                    }
                });
            }

            /**
             * Takes a single mapping and binds the state of the component to the store
             *
             * @param mapping.key key to connect to. can be a string or a
             * function that takes this.props as an argument and returns a string
             * @param statePropertyName the name of the state property that Onyx will add the data to
             * @param [mapping.initWithStoredValues] If set to false, then no data will be prefilled into the
             *  component
             * @param key to connect to Onyx with
             */
            connectMappingToOnyx(mapping: MapOnyxToState<TComponentProps, TOnyxProps>[keyof TOnyxProps], statePropertyName: keyof TOnyxProps, key: OnyxKey) {
                // Remember what the previous key was so that key changes can be detected when data is being loaded from Onyx. This will allow
                // dependent keys to finish loading their data.
                // eslint-disable-next-line no-param-reassign
                mapOnyxToState[statePropertyName].previousKey = key;

                // eslint-disable-next-line rulesdir/prefer-onyx-connect-in-libs
                this.activeConnectionIDs[key] = Onyx.connect({
                    ...mapping,
                    key,
                    statePropertyName: statePropertyName as string,
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
                    this.setState(modifier as WithOnyxState<TOnyxProps>);
                });

                this.pendingSetStates = [];
            }

            render() {
                // Remove any null values so that React replaces them with default props
                const propsToPass = utils.omit(this.props, (entry) => entry[1] === null);

                if (this.state.loading) {
                    return null;
                }

                // Remove any internal state properties used by withOnyx
                // that should not be passed to a wrapped component
                const stateToPass = utils.omit(this.state as WithOnyxState<TOnyxProps>, (entry) => entry[0] === 'loading' || entry[1] === null);
                const stateToPassWithoutNestedNulls = utils.removeNestedNullValues(stateToPass);

                // Spreading props and state is necessary in an HOC where the data cannot be predicted
                return (
                    <WrappedComponent
                        markReadyForHydration={this.flushPendingSetStates}
                        // eslint-disable-next-line react/jsx-props-no-spreading
                        {...propsToPass}
                        // eslint-disable-next-line react/jsx-props-no-spreading
                        {...stateToPassWithoutNestedNulls}
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
