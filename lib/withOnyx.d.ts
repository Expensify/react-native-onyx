import {IsEqual} from 'type-fest';
import {GetOnyxValue, OnyxKey, Selector} from './types';

type BaseMapping<TComponentProps, TOnyxProps> = {
    canEvict?: boolean | ((props: Omit<TComponentProps, keyof TOnyxProps>) => boolean);
    initWithStoredValues?: boolean;
};

type Mapping<TComponentProps, TOnyxProps, TOnyxProp extends keyof TOnyxProps, TOnyxKey extends OnyxKey> = BaseMapping<TComponentProps, TOnyxProps> &
    (
        | (IsEqual<GetOnyxValue<TOnyxKey> | null, TOnyxProps[TOnyxProp]> extends true
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

type OnyxPropMapping<TComponentProps, TOnyxProps, TOnyxProp extends keyof TOnyxProps> = {
    [TOnyxKey in OnyxKey]: Mapping<TComponentProps, TOnyxProps, TOnyxProp, TOnyxKey>;
}[OnyxKey];

declare function withOnyx<TComponentProps, TOnyxProps>(
    mapping: {
        [TOnyxProp in keyof TOnyxProps]: OnyxPropMapping<TComponentProps, TOnyxProps, TOnyxProp>;
    },
): (component: React.ComponentType<TComponentProps>) => React.ComponentType<Omit<TComponentProps, keyof TOnyxProps>>;

export default withOnyx;
