import {Merge} from 'type-fest';
import {BuiltIns} from 'type-fest/source/internal';

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
 * Represents a selector function type which operates based on the provided `TKey` and `ReturnType`.
 *
 * A `Selector` is a function that accepts a value, the withOnyx's internal state and returns a processed value.
 * This type accepts two type parameters: `TKey` and `TReturnType`.
 *
 * The type `TKey` extends `OnyxKey` and it is the key used to access a value in `KeyValueMapping`.
 * `TReturnType` is the type of the returned value from the selector function.
 */
type Selector<TKey extends OnyxKey, TOnyxProps, TReturnType> = (value: OnyxEntry<KeyValueMapping[TKey]>, state: WithOnyxInstanceState<TOnyxProps>) => TReturnType;

/**
 * Represents a single Onyx entry, that can be either `TOnyxValue` or `null` if it doesn't exist.
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
type OnyxEntry<TOnyxValue> = TOnyxValue | null;

/**
 * Represents an Onyx collection of entries, that can be either a record of `TOnyxValue`s or `null` if it is empty or doesn't exist.
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
type OnyxCollection<TOnyxValue> = OnyxEntry<Record<string, TOnyxValue | null>>;

type NonTransformableTypes =
    | BuiltIns
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
 * Represents withOnyx's internal state, containing the Onyx props and a `loading` flag.
 */
type WithOnyxInstanceState<TOnyxProps> = (TOnyxProps & {loading: boolean}) | undefined;

export {CollectionKey, CollectionKeyBase, CustomTypeOptions, DeepRecord, Key, KeyValueMapping, OnyxCollection, OnyxEntry, OnyxKey, Selector, NullishDeep, WithOnyxInstanceState};
