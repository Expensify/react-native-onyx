import {IsEqual} from 'type-fest';

/**
 * Represents a merged object between `TObject` and `TOtherObject`.
 * If both objects have a property with the same name, the type from `TOtherObject` is used.
 */
type MergeBy<TObject, TOtherObject> = Omit<TObject, keyof TOtherObject> & TOtherObject;

/**
 * Represents a deeply nested record. It maps keys to values,
 * and those values can either be of type `TValue` or further nested `DeepRecord` instances.
 */
type DeepRecord<TKey extends string | number | symbol, TValue> = {[key: string]: TValue | DeepRecord<TKey, TValue>};

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
type TypeOptions = MergeBy<
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
 *     [report: `${typeof ONYXKEYS.COLLECTION.REPORT}${string}`]: Report;
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
 * Represents a Record where each key is an Onyx key and each value is its corresponding Onyx value type.
 */
type KeyValueMapping = TypeOptions['values'];

/**
 * Represents a selector function type which operates based on the provided `TKey` and `ReturnType`.
 *
 * A `Selector` is a function that accepts a value and returns a processed value.
 * This type accepts two type parameters: `TKey` and `TReturnType`.
 *
 * The type `TKey` extends `OnyxKey` and it is the key used to access a value in `KeyValueMapping`.
 * `TReturnType` is the type of the returned value from the selector function.
 *
 * If `KeyValueMapping[TKey]` is equal to 'unknown', the `Selector` type represents a function
 * that takes any value and returns an `unknown` value.
 *
 * If `KeyValueMapping[TKey]` is not 'unknown', the `Selector` type represents a function that
 * takes either the value of type `OnyxRecord<KeyValueMapping[TKey]>`, and returns a value of `TReturnType`.
 */
type Selector<TKey extends OnyxKey, TReturnType> = IsEqual<KeyValueMapping[TKey], unknown> extends true
    ? (value: unknown) => unknown
    : (value: OnyxRecord<KeyValueMapping[TKey]>) => TReturnType;

/**
 * Represents a single Onyx record, that can be either `TOnyxValue` or `null` if it doesn't exist.
 */
type OnyxRecord<TOnyxValue> = TOnyxValue | null;

/**
 * Represents an Onyx collection of records, that can be either a record of `TOnyxValue`s or `null` if it is empty or doesn't exist.
 */
type OnyxCollectionRecords<TOnyxValue> = Record<string, TOnyxValue | null> | null;

export {
    CollectionKey,
    CollectionKeyBase,
    CustomTypeOptions,
    DeepRecord,
    Key,
    KeyValueMapping,
    MergeBy,
    OnyxKey,
    Selector,
    TypeOptions,
    OnyxRecord,
    OnyxCollectionRecords,
};
