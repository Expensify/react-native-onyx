import type {Merge} from 'type-fest';
import type {BuiltIns} from 'type-fest/source/internal';
import type OnyxUtils from './OnyxUtils';
import type {WithOnyxInstance, WithOnyxState} from './withOnyx/types';
import type {OnyxMethod} from './OnyxUtils';
import type {FastMergeReplaceNullPatch} from './utils';

/**
 * Utility type that excludes `null` from the type `TValue`.
 */
type NonNull<TValue> = TValue extends null ? never : TValue;

/**
 * Utility type that excludes `undefined` from the type `TValue`.
 */
type NonUndefined<TValue> = TValue extends undefined ? never : TValue;

/**
 * Represents a deeply nested record. It maps keys to values,
 * and those values can either be of type `TValue` or further nested `DeepRecord` instances.
 */
type DeepRecord<TKey extends string | number | symbol, TValue> = {
    [key: string]: TValue | DeepRecord<TKey, TValue>;
};

/**
 * Represents type options to configure all Onyx methods.
 * It's a combination of predefined options with user-provided options (CustomTypeOptions).
 *
 * The options are:
 * - `keys`: Represents a string union of all Onyx normal keys.
 * - `collectionKeys`: Represents a string union of all Onyx collection keys.
 * - `values`: Represents a Record where each key is an Onyx key and each value is its corresponding Onyx value type.
 *
 * The user-defined options (CustomTypeOptions) are merged into these predefined options.
 * In case of conflicting properties, the ones from CustomTypeOptions are prioritized.
 */
type TypeOptions = Merge<
    {
        keys: string;
        collectionKeys: string;
        values: Record<string, unknown>;
    },
    CustomTypeOptions
>;

/**
 * Represents the user-defined options to configure all Onyx methods.
 *
 * The developer can configure Onyx methods by augmenting this library and overriding CustomTypeOptions.
 *
 * @example
 * ```ts
 * // ONYXKEYS.ts
 * import {ValueOf} from 'type-fest';
 * import { Account, Report } from './types';
 *
 * const ONYXKEYS = {
 *     ACCOUNT: 'account',
 *     IS_SIDEBAR_LOADED: 'isSidebarLoaded',
 *
 *     // Collection Keys
 *     COLLECTION: {
 *         REPORT: 'report_',
 *     },
 * } as const;
 *
 * type OnyxKeysMap = typeof ONYXKEYS;
 * type OnyxCollectionKey = ValueOf<OnyxKeysMap['COLLECTION']>;
 * type OnyxKey = DeepValueOf<Omit<OnyxKeysMap, 'COLLECTION'>>;
 *
 * type OnyxValues = {
 *     [ONYXKEYS.ACCOUNT]: Account;
 *     [ONYXKEYS.IS_SIDEBAR_LOADED]: boolean;
 *     [ONYXKEYS.COLLECTION.REPORT]: Report;
 * };
 *
 * export default ONYXKEYS;
 * export type {OnyxKey, OnyxCollectionKey, OnyxValues};
 *
 * // global.d.ts
 * import {OnyxKey, OnyxCollectionKey, OnyxValues} from './ONYXKEYS';
 *
 * declare module 'react-native-onyx' {
 *     interface CustomTypeOptions {
 *         keys: OnyxKey;
 *         collectionKeys: OnyxCollectionKey;
 *         values: OnyxValues;
 *     }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface CustomTypeOptions {}

/**
 * Represents a string union of all Onyx normal keys.
 */
type Key = TypeOptions['keys'];

/**
 * Represents a string union of all Onyx collection keys.
 */
type CollectionKeyBase = TypeOptions['collectionKeys'];

/**
 * Represents a literal string union of all Onyx collection keys.
 * It allows appending a string after each collection key e.g. `report_some-id`.
 */
type CollectionKey = `${CollectionKeyBase}${string}`;

/**
 * Represents a string union of all Onyx normal and collection keys.
 */
type OnyxKey = Key | CollectionKey;

/**
 * Represents a selector function type which operates based on the provided `TKey` and `ReturnType`.
 *
 * A `Selector` is a function that accepts a value, the withOnyx's internal state and returns a processed value.
 * This type accepts two type parameters: `TKey` and `TReturnType`.
 *
 * The type `TKey` extends `OnyxKey` and it is the key used to access a value in `KeyValueMapping`.
 * `TReturnType` is the type of the returned value from the selector function.
 */
type Selector<TKey extends OnyxKey, TOnyxProps, TReturnType> = (value: OnyxEntry<KeyValueMapping[TKey]>, state?: WithOnyxState<TOnyxProps>) => TReturnType;

/**
 * Represents a single Onyx entry, that can be either `TOnyxValue` or `undefined` if it doesn't exist.
 *
 * It can be used to specify data retrieved from Onyx e.g. `withOnyx` HOC mappings.
 *
 * @example
 * ```ts
 * import Onyx, {OnyxEntry, withOnyx} from 'react-native-onyx';
 *
 * type OnyxProps = {
 *     userAccount: OnyxEntry<Account>;
 * };
 *
 * type Props = OnyxProps & {
 *     prop1: string;
 * };
 *
 * function Component({prop1, userAccount}: Props) {
 *     // ...
 * }
 *
 * export default withOnyx<Props, OnyxProps>({
 *     userAccount: {
 *         key: ONYXKEYS.ACCOUNT,
 *     },
 * })(Component);
 * ```
 */
type OnyxEntry<TOnyxValue> = TOnyxValue | undefined;

/**
 * Represents an Onyx collection of entries, that can be either a record of `TOnyxValue`s or `undefined` if it is empty or doesn't exist.
 *
 * It can be used to specify collection data retrieved from Onyx e.g. `withOnyx` HOC mappings.
 *
 * @example
 * ```ts
 * import Onyx, {OnyxCollection, withOnyx} from 'react-native-onyx';
 *
 * type OnyxProps = {
 *     reports: OnyxCollection<Report>;
 * };
 *
 * type Props = OnyxProps & {
 *     prop1: string;
 * };
 *
 * function Component({prop1, reports}: Props) {
 *     // ...
 * }
 *
 * export default withOnyx<Props, OnyxProps>({
 *     reports: {
 *         key: ONYXKEYS.COLLECTION.REPORT,
 *     },
 * })(Component);
 * ```
 */
type OnyxCollection<TOnyxValue> = OnyxEntry<Record<string, TOnyxValue | undefined>>;

/**
 * Represents a mapping of Onyx keys to values, where keys are either normal or collection Onyx keys
 * and values are the corresponding values in Onyx's state.
 *
 * For collection keys, `KeyValueMapping` allows any string to be appended
 * to the key (e.g., 'report_some-id', 'download_some-id').
 *
 * The mapping is derived from the `values` property of the `TypeOptions` type.
 */
type KeyValueMapping = {
    [TKey in keyof TypeOptions['values'] as TKey extends CollectionKeyBase ? `${TKey}${string}` : TKey]: TypeOptions['values'][TKey];
};

/**
 * Represents a Onyx value that can be either a single entry or a collection of entries, depending on the `TKey` provided.
 */
type OnyxValue<TKey extends OnyxKey> = string extends TKey ? unknown : TKey extends CollectionKeyBase ? OnyxCollection<KeyValueMapping[TKey]> : OnyxEntry<KeyValueMapping[TKey]>;

/** Utility type to extract `TOnyxValue` from `OnyxCollection<TOnyxValue>` */
type ExtractOnyxCollectionValue<TOnyxCollection> = TOnyxCollection extends NonNullable<OnyxCollection<infer U>> ? U : never;

type NonTransformableTypes =
    | BuiltIns
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | ((...args: any[]) => unknown)
    | Map<unknown, unknown>
    | Set<unknown>
    | ReadonlyMap<unknown, unknown>
    | ReadonlySet<unknown>
    | unknown[]
    | readonly unknown[];

/**
 * Create a type from another type with all keys and nested keys set to optional or null.
 *
 * @example
 * const settings: Settings = {
 *	 textEditor: {
 *	 	fontSize: 14;
 *	 	fontColor: '#000000';
 *	 	fontWeight: 400;
 *	 }
 *	 autosave: true;
 * };
 *
 * const applySavedSettings = (savedSettings: NullishDeep<Settings>) => {
 * 	 return {...settings, ...savedSettings};
 * }
 *
 * settings = applySavedSettings({textEditor: {fontWeight: 500, fontColor: null}});
 */
type NullishDeep<T> = T extends NonTransformableTypes ? T : T extends object ? NullishObjectDeep<T> : unknown;

/**
 * Same as `NullishDeep`, but accepts only `object`s as inputs. Internal helper for `NullishDeep`.
 */
type NullishObjectDeep<ObjectType extends object> = {
    [KeyType in keyof ObjectType]?: NullishDeep<ObjectType[KeyType]> | null;
};

/**
 * Represents a mapping between Onyx collection keys and their respective values.
 *
 * It helps to enforce that a Onyx collection key should not be without suffix (e.g. should always be of the form `${TKey}${string}`),
 * and to map each Onyx collection key with suffix to a value of type `TValue`.
 *
 * Also, the `TMap` type is inferred automatically in `mergeCollection()` method and represents
 * the object of collection keys/values specified in the second parameter of the method.
 */
type Collection<TKey extends CollectionKeyBase, TValue, TMap = never> = {
    [MapK in keyof TMap]: MapK extends `${TKey}${string}`
        ? MapK extends `${TKey}`
            ? never // forbids empty id
            : TValue
        : never;
};

/** Represents the base options used in `Onyx.connect()` method. */
// NOTE: Any changes to this type like adding or removing options must be accounted in OnyxConnectionManager's `generateConnectionID()` method!
type BaseConnectOptions = {
    /** If set to `false`, then the initial data will be only sent to the callback function if it changes. */
    initWithStoredValues?: boolean;

    /**
     * If set to `false`, the connection won't be reused between other subscribers that are listening to the same Onyx key
     * with the same connect configurations.
     */
    reuseConnection?: boolean;
};

/** Represents the callback function used in `Onyx.connect()` method with a regular key. */
type DefaultConnectCallback<TKey extends OnyxKey> = (value: OnyxEntry<KeyValueMapping[TKey]>, key: TKey) => void;

/** Represents the callback function used in `Onyx.connect()` method with a collection key. */
type CollectionConnectCallback<TKey extends OnyxKey> = (value: NonUndefined<OnyxCollection<KeyValueMapping[TKey]>>, key: TKey, sourceValue?: OnyxValue<TKey>) => void;

/** Represents the options used in `Onyx.connect()` method with a regular key. */
// NOTE: Any changes to this type like adding or removing options must be accounted in OnyxConnectionManager's `generateConnectionID()` method!
type DefaultConnectOptions<TKey extends OnyxKey> = BaseConnectOptions & {
    /** The Onyx key to subscribe to. */
    key: TKey;

    /** A function that will be called when the Onyx data we are subscribed changes. */
    callback?: DefaultConnectCallback<TKey>;

    /** If set to `true`, it will return the entire collection to the callback as a single object. */
    waitForCollectionCallback?: false;
};

/** Represents the options used in `Onyx.connect()` method with a collection key. */
// NOTE: Any changes to this type like adding or removing options must be accounted in OnyxConnectionManager's `generateConnectionID()` method!
type CollectionConnectOptions<TKey extends OnyxKey> = BaseConnectOptions & {
    /** The Onyx key to subscribe to. */
    key: TKey extends CollectionKeyBase ? TKey : never;

    /** A function that will be called when the Onyx data we are subscribed changes. */
    callback?: CollectionConnectCallback<TKey>;

    /** If set to `true`, it will return the entire collection to the callback as a single object. */
    waitForCollectionCallback: true;
};

/**
 * Represents the options used in `Onyx.connect()` method.
 * The type is built from `DefaultConnectOptions`/`CollectionConnectOptions` depending on the `waitForCollectionCallback` property.
 * It includes two different forms, depending on whether we are waiting for a collection callback or not.
 *
 * If `waitForCollectionCallback` is `true`, it expects `key` to be a Onyx collection key and `callback` will be triggered with the whole collection
 * and will pass `value` as an `OnyxCollection`.
 *
 * If `waitForCollectionCallback` is `false` or not specified, the `key` can be any Onyx key and `callback` will be triggered with updates of each collection item
 * and will pass `value` as an `OnyxEntry`.
 */
// NOTE: Any changes to this type like adding or removing options must be accounted in OnyxConnectionManager's `generateConnectionID()` method!
type ConnectOptions<TKey extends OnyxKey> = DefaultConnectOptions<TKey> | CollectionConnectOptions<TKey>;

/** Represents additional `Onyx.connect()` options used inside `withOnyx()` HOC. */
// NOTE: Any changes to this type like adding or removing options must be accounted in OnyxConnectionManager's `generateConnectionID()` method!
type WithOnyxConnectOptions<TKey extends OnyxKey> = ConnectOptions<TKey> & {
    /** The `withOnyx` class instance to be internally passed. */
    withOnyxInstance: WithOnyxInstance;

    /** The name of the component's prop that is connected to the Onyx key. */
    statePropertyName: string;

    /** The component's display name. */
    displayName: string;

    /**
     * This will be used to subscribe to a subset of an Onyx key's data.
     * Using this setting on `withOnyx` can have very positive performance benefits because the component will only re-render
     * when the subset of data changes. Otherwise, any change of data on any property would normally
     * cause the component to re-render (and that can be expensive from a performance standpoint).
     */
    selector?: Selector<TKey, unknown, unknown>;

    /** Determines if this key in this subscription is safe to be evicted. */
    canEvict?: boolean;
};

type Mapping<TKey extends OnyxKey> = WithOnyxConnectOptions<TKey> & {
    subscriptionID: number;
};

/**
 * Represents a single Onyx input value, that can be either `TOnyxValue` or `null` if the key should be deleted.
 * This type is used for data passed to Onyx e.g. in `Onyx.merge` and `Onyx.set`.
 */
type OnyxInputValue<TOnyxValue> = TOnyxValue | null;

/**
 * Represents an Onyx collection input, that can be either a record of `TOnyxValue`s or `null` if the key should be deleted.
 */
type OnyxCollectionInputValue<TOnyxValue> = OnyxInputValue<Record<string, TOnyxValue | null>>;

/**
 * Represents an input value that can be passed to Onyx methods, that can be either `TOnyxValue` or `null`.
 * Setting a key to `null` will remove the key from the store.
 * `undefined` is not allowed for setting values, because it will have no effect on the data.
 */
type OnyxInput<TKey extends OnyxKey> = OnyxInputValue<NullishDeep<KeyValueMapping[TKey]>>;

/**
 * Represents a mapping object where each `OnyxKey` maps to either a value of its corresponding type in `KeyValueMapping` or `null`.
 *
 * It's very similar to `KeyValueMapping` but this type is used for inputs to Onyx
 * (set, merge, mergeCollection) and therefore accepts using `null` to remove a key from Onyx.
 */
type OnyxInputKeyValueMapping = {
    [TKey in OnyxKey]: OnyxInput<TKey>;
};

/**
 * This represents the value that can be passed to `Onyx.set` and to `Onyx.update` with the method "SET"
 */
type OnyxSetInput<TKey extends OnyxKey> = OnyxInput<TKey>;

/**
 * This represents the value that can be passed to `Onyx.multiSet` and to `Onyx.update` with the method "MULTI_SET"
 */
type OnyxMultiSetInput = Partial<OnyxInputKeyValueMapping>;

/**
 * This represents the value that can be passed to `Onyx.merge` and to `Onyx.update` with the method "MERGE"
 */
type OnyxMergeInput<TKey extends OnyxKey> = OnyxInput<TKey>;

/**
 * This represents the value that can be passed to `Onyx.merge` and to `Onyx.update` with the method "MERGE"
 */
type OnyxMergeCollectionInput<TKey extends OnyxKey, TMap = object> = Collection<TKey, NonNullable<OnyxInput<TKey>>, TMap>;

type OnyxMethodMap = typeof OnyxUtils.METHOD;

// Maps onyx methods to their corresponding value types
type OnyxMethodValueMap = {
    [OnyxUtils.METHOD.SET]: {
        key: OnyxKey;
        value: OnyxSetInput<OnyxKey>;
    };
    [OnyxUtils.METHOD.MULTI_SET]: {
        key: OnyxKey;
        value: OnyxMultiSetInput;
    };
    [OnyxUtils.METHOD.MERGE]: {
        key: OnyxKey;
        value: OnyxMergeInput<OnyxKey>;
    };
    [OnyxUtils.METHOD.CLEAR]: {
        key: OnyxKey;
        value?: undefined;
    };
    [OnyxUtils.METHOD.MERGE_COLLECTION]: {
        key: CollectionKeyBase;
        value: OnyxMergeCollectionInput<CollectionKeyBase>;
    };
    [OnyxUtils.METHOD.SET_COLLECTION]: {
        key: CollectionKeyBase;
        value: OnyxMergeCollectionInput<CollectionKeyBase>;
    };
};

/**
 * OnyxUpdate type includes all onyx methods used in OnyxMethodValueMap.
 * If a new method is added to OnyxUtils.METHOD constant, it must be added to OnyxMethodValueMap type.
 * Otherwise it will show static type errors.
 */
type OnyxUpdate = {
    [Method in OnyxMethod]: {
        onyxMethod: Method;
    } & OnyxMethodValueMap[Method];
}[OnyxMethod];

/**
 * Represents the options used in `Onyx.set()` method.
 */
type SetOptions = {
    /** Skip the deep equality check against the cached value. Improves performance for large objects. */
    skipCacheCheck?: boolean;
};

/**
 * Represents the options used in `Onyx.init()` method.
 */
type InitOptions = {
    /** `ONYXKEYS` constants object */
    keys?: DeepRecord<string, OnyxKey>;

    /** initial data to set when `init()` and `clear()` is called */
    initialKeyStates?: Partial<OnyxInputKeyValueMapping>;

    /**
     * This is an array of keys (individual or collection patterns) that when provided to Onyx are flagged
     * as "safe" for removal. Any components subscribing to these keys must also implement a canEvict option. See the README for more info.
     */
    evictableKeys?: OnyxKey[];

    /**
     * Sets how many recent keys should we try to keep in cache
     * Setting this to 0 would practically mean no cache
     * We try to free cache when we connect to a safe eviction key
     */
    maxCachedKeysCount?: number;

    /**
     * Auto synchronize storage events between multiple instances
     * of Onyx running in different tabs/windows. Defaults to true for platforms that support local storage (web/desktop)
     */
    shouldSyncMultipleInstances?: boolean;

    /** Enables debugging setState() calls to connected components */
    debugSetState?: boolean;

    /**
     * If enabled it will use the performance API to measure the time taken by Onyx operations.
     * @default false
     */
    enablePerformanceMetrics?: boolean;

    /**
     * Array of collection member IDs which updates will be ignored when using Onyx methods.
     * Additionally, any subscribers from these keys to won't receive any data from Onyx.
     */
    skippableCollectionMemberIDs?: string[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GenericFunction = (...args: any[]) => any;

/**
 * Represents a record where the key is a collection member key and the value is a list of
 * tuples that we'll use to replace the nested objects of that collection member record with something else.
 */
type MultiMergeReplaceNullPatches = {
    [TKey in OnyxKey]: FastMergeReplaceNullPatch[];
};

/**
 * Represents a combination of Merge and Set operations that should be executed in Onyx
 */
type MixedOperationsQueue = {
    merge: OnyxInputKeyValueMapping;
    mergeReplaceNullPatches: MultiMergeReplaceNullPatches;
    set: OnyxInputKeyValueMapping;
};

export type {
    BaseConnectOptions,
    Collection,
    CollectionConnectCallback,
    CollectionConnectOptions,
    CollectionKey,
    CollectionKeyBase,
    ConnectOptions,
    CustomTypeOptions,
    DeepRecord,
    DefaultConnectCallback,
    DefaultConnectOptions,
    ExtractOnyxCollectionValue,
    GenericFunction,
    InitOptions,
    Key,
    KeyValueMapping,
    Mapping,
    NonNull,
    NonUndefined,
    OnyxInputKeyValueMapping,
    NullishDeep,
    OnyxCollection,
    OnyxEntry,
    OnyxKey,
    OnyxInputValue,
    OnyxCollectionInputValue,
    OnyxInput,
    OnyxSetInput,
    OnyxMultiSetInput,
    OnyxMergeInput,
    OnyxMergeCollectionInput,
    OnyxMethod,
    OnyxMethodMap,
    OnyxUpdate,
    OnyxValue,
    Selector,
    SetOptions,
    WithOnyxConnectOptions,
    MultiMergeReplaceNullPatches,
    MixedOperationsQueue,
};
