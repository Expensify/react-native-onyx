import type StorageProvider from './providers/types';
type Storage = {
    getStorageProvider: () => StorageProvider;
} & Omit<StorageProvider, 'name'>;
declare const Storage: Storage;
export default Storage;
