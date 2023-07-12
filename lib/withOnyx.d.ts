import {IsEqual} from 'type-fest';
import {Key, Selector, Value} from './types';

type Mapping<TComponentProps, TOnyxProps, TMappingKey extends keyof TOnyxProps, TOnyxKey extends Key> = IsEqual<Value[TOnyxKey] | null, TOnyxProps[TMappingKey]> extends true
    ? {
          key: TOnyxKey | ((props: Omit<TComponentProps, keyof TOnyxProps>) => TOnyxKey);
          canEvict?: boolean | ((props: Omit<TComponentProps, keyof TOnyxProps>) => boolean);
          initWithStoredValues?: boolean;
          selector?: Selector<TOnyxKey>;
      }
    : never;

type KeyValueMapping<TComponentProps, TOnyxProps, TMappingKey extends keyof TOnyxProps> = {
    [TOnyxKey in Key]: Mapping<TComponentProps, TOnyxProps, TMappingKey, TOnyxKey>;
}[Key];

declare function withOnyx<TComponentProps, TOnyxProps>(
    mapping: {
        [TMappingKey in keyof TOnyxProps]: KeyValueMapping<TComponentProps, TOnyxProps, TMappingKey>;
    },
): (component: React.ComponentType<TComponentProps>) => React.ComponentType<Omit<TComponentProps, keyof TOnyxProps>>;

export default withOnyx;
