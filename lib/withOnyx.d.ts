import {IsEqual} from 'type-fest';
import {DeepKeyOf, TypeOptions} from './types';

type Key = TypeOptions['keys'];
type Value = TypeOptions['values'];

type Mapping<TComponentProps, TOnyxProps, TMappingKey extends keyof TOnyxProps, TOnyxKey extends Key> = IsEqual<Value[TOnyxKey] | null, TOnyxProps[TMappingKey]> extends true
    ? {
          // key: TOnyxKey | ((props: Omit<TComponentProps, keyof TOnyxProps>) => TOnyxKey); // FIXME: Breaks the key/value inference.
          key: TOnyxKey;
          canEvict?: boolean | ((props: Omit<TComponentProps, keyof TOnyxProps>) => boolean);
          initWithStoredValues?: boolean;
          selector?: Value[TOnyxKey] extends object | string | number | boolean ? ((value: Value[TOnyxKey] | null) => TOnyxProps[TMappingKey]) | DeepKeyOf<Value[TOnyxKey]> : never;
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
