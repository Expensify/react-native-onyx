import {IsEqual} from 'type-fest';
import {CollectionKeyBase, KeyValueMapping, OnyxCollection, OnyxEntry, OnyxKey, Selector} from './types';

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
type BaseMappingStringKeyAndSelector<TComponentProps, TOnyxProps, TOnyxProp extends keyof TOnyxProps, TOnyxKey extends OnyxKey> = {
    key: TOnyxKey;
    selector: Selector<TOnyxKey, TOnyxProps, TOnyxProps[TOnyxProp]>;
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
type BaseMappingFunctionKeyAndSelector<TComponentProps, TOnyxProps, TOnyxProp extends keyof TOnyxProps, TOnyxKey extends OnyxKey> = {
    key: (props: Omit<TComponentProps, keyof TOnyxProps> & Partial<TOnyxProps>) => TOnyxKey;
    selector: Selector<TOnyxKey, TOnyxProps, TOnyxProps[TOnyxProp]>;
};

/**
 * Represents the mapping options between an Onyx key and the component's prop with all its possibilities.
 */
type Mapping<TComponentProps, TOnyxProps, TOnyxProp extends keyof TOnyxProps, TOnyxKey extends OnyxKey> = BaseMapping<TComponentProps, TOnyxProps> &
    EntryBaseMapping<TOnyxKey> &
    (
        | BaseMappingKey<TComponentProps, TOnyxProps, TOnyxProp, TOnyxKey, OnyxEntry<KeyValueMapping[TOnyxKey]>>
        | BaseMappingStringKeyAndSelector<TComponentProps, TOnyxProps, TOnyxProp, TOnyxKey>
        | BaseMappingFunctionKeyAndSelector<TComponentProps, TOnyxProps, TOnyxProp, TOnyxKey>
    );

/**
 * Represents the mapping options between an Onyx collection key without suffix and the component's prop with all its possibilities.
 */
type CollectionMapping<TComponentProps, TOnyxProps, TOnyxProp extends keyof TOnyxProps, TOnyxKey extends CollectionKeyBase> = BaseMapping<TComponentProps, TOnyxProps> &
    CollectionBaseMapping<TOnyxKey> &
    (
        | BaseMappingKey<TComponentProps, TOnyxProps, TOnyxProp, TOnyxKey, OnyxCollection<KeyValueMapping[TOnyxKey]>>
        | BaseMappingStringKeyAndSelector<TComponentProps, TOnyxProps, TOnyxProp, TOnyxKey>
        | BaseMappingFunctionKeyAndSelector<TComponentProps, TOnyxProps, TOnyxProp, TOnyxKey>
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

/**
 * This is a higher order component that provides the ability to map a state property directly to
 * something in Onyx (a key/value store). That way, as soon as data in Onyx changes, the state will be set and the view
 * will automatically change to reflect the new data.
 */
declare function withOnyx<TComponentProps, TOnyxProps>(
    mapping: {
        [TOnyxProp in keyof TOnyxProps]: OnyxPropMapping<TComponentProps, TOnyxProps, TOnyxProp> | OnyxPropCollectionMapping<TComponentProps, TOnyxProps, TOnyxProp>;
    },
    shouldDelayUpdates?: boolean,
): (component: React.ComponentType<TComponentProps>) => React.ComponentType<Omit<TComponentProps, keyof TOnyxProps>>;

export default withOnyx;
