import {IsEqual} from 'type-fest';
import {Key, CollectionKey, Selector, Value} from './types';

type BaseMapping<TComponentProps, TOnyxProps> = {
    canEvict?: boolean | ((props: Omit<TComponentProps, keyof TOnyxProps>) => boolean);
    initWithStoredValues?: boolean;
};

type Mapping<TComponentProps, TOnyxProps, TOnyxProp extends keyof TOnyxProps, TOnyxKey extends Key | CollectionKey> = BaseMapping<TComponentProps, TOnyxProps> &
    (
        | (IsEqual<Value[TOnyxKey] | null, TOnyxProps[TOnyxProp]> extends true
              ? {
                    key: TOnyxKey | ((props: Omit<TComponentProps, keyof TOnyxProps>) => TOnyxKey);
                }
              : never)
        | {
              key: TOnyxKey;
              selector: Selector<TOnyxKey, TOnyxProps[TOnyxProp]>;
          }
        | {
              key: (props: Omit<TComponentProps, keyof TOnyxProps>) => TOnyxKey;
              selector: Selector<TOnyxKey, TOnyxProps[TOnyxProp]>;
          }
    );

// TODO: Missing implementation.
declare function createOnyxSelector<TOnyxKey extends Key | CollectionKey, TResultData>(selector: Selector<TOnyxKey, TResultData>): Selector<TOnyxKey, TResultData>;

type OnyxPropMapping<TComponentProps, TOnyxProps, TOnyxProp extends keyof TOnyxProps> = {
    [TOnyxKey in Key | CollectionKey]: Mapping<TComponentProps, TOnyxProps, TOnyxProp, TOnyxKey>;
}[Key | CollectionKey];

declare function withOnyx<TComponentProps, TOnyxProps>(
    mapping: {
        [TOnyxProp in keyof TOnyxProps]: OnyxPropMapping<TComponentProps, TOnyxProps, TOnyxProp>;
    },
): (component: React.ComponentType<TComponentProps>) => React.ComponentType<Omit<TComponentProps, keyof TOnyxProps>>;

export default withOnyx;
export {createOnyxSelector};
