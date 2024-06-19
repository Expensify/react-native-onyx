import type {ForwardedRef} from 'react';
import type {IsEqual} from 'type-fest';
import type {CollectionKeyBase, ExtractOnyxCollectionValue, KeyValueMapping, OnyxCollection, OnyxEntry, OnyxKey, OnyxValue, Selector} from '../types';

/**
 * Represents the base mapping options between an Onyx key and the component's prop.
 */
type BaseMapping<TComponentProps, TOnyxProps> = {
    canEvict?: boolean | ((props: Omit<TComponentProps, keyof TOnyxProps>) => boolean);
    initWithStoredValues?: boolean;
    allowStaleData?: boolean;
};

/**
 * Represents the base mapping options when an Onyx collection key is supplied.
 */
type CollectionBaseMapping<TOnyxKey extends CollectionKeyBase> = {
    initialValue?: OnyxCollection<KeyValueMapping[TOnyxKey]>;
};

/**
 * Represents the base mapping options when an Onyx non-collection key is supplied.
 */
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
 * Represents a superset of `Mapping` type with internal properties included.
 */
type WithOnyxMapping<TComponentProps, TOnyxProps> = Mapping<TComponentProps, TOnyxProps, keyof TOnyxProps, OnyxKey> & {
    connectionID: number;
    previousKey?: OnyxKey;
};

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

/**
 * Represents an Onyx mapping object that connects Onyx keys to component's props.
 */
type MapOnyxToState<TComponentProps, TOnyxProps> = {
    [TOnyxProp in keyof TOnyxProps]: OnyxPropMapping<TComponentProps, TOnyxProps, TOnyxProp> | OnyxPropCollectionMapping<TComponentProps, TOnyxProps, TOnyxProp>;
};

/**
 * Represents the `withOnyx` internal component props.
 */
type WithOnyxProps<TComponentProps, TOnyxProps> = Omit<TComponentProps, keyof TOnyxProps> & {forwardedRef?: ForwardedRef<unknown>};

/**
 * Represents the `withOnyx` internal component state.
 */
type WithOnyxState<TOnyxProps> = TOnyxProps & {
    loading: boolean;
};

/**
 * Represents the `withOnyx` internal component instance.
 */
type WithOnyxInstance = React.Component<unknown, WithOnyxState<KeyValueMapping>> & {
    setStateProxy: (modifier: Record<string, OnyxCollection<KeyValueMapping[OnyxKey]>> | ((state: Record<string, OnyxCollection<KeyValueMapping[OnyxKey]>>) => OnyxValue<OnyxKey>)) => void;
    setWithOnyxState: (statePropertyName: OnyxKey, value: OnyxValue<OnyxKey>) => void;
};

export type {WithOnyxMapping, MapOnyxToState, WithOnyxProps, WithOnyxInstance, WithOnyxState};
