import type StorageProvider from './types';
import type { OnyxKey, OnyxValue } from '../../types';
type Store = Record<OnyxKey, OnyxValue<OnyxKey>>;
declare let store: Store;
declare const set: (key: OnyxKey, value: OnyxValue<OnyxKey>) => Promise<unknown>;
declare const provider: StorageProvider;
declare const setMockStore: (data: Store) => void;
export default provider;
export { store as mockStore, set as mockSet, setMockStore };
