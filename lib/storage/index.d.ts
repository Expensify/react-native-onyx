/**
 * Storage interaction interface used by Onyx internally
 * It's used to hook Onyx to different storage layers
 */
interface StorageProvider {
    getAllKeys(): Promise<string[]>,
    getItem<T>(key: string): Promise<string|null>,
    multiGet<T>(keys: string[]): Promise<Array<[string, T|null]>>,
    removeItem(key: string): Promise<void>,
    setItem<T>(key: string, value: T): Promise<void>,
    multiSet<T>(pairs: Array<[string, T|null]>): Promise<void>,
    multiMerge<T>(pairs: Array<[string, T|null]>): Promise<void>,
    clear(): Promise<void>,
    prepareFile(file: any): {uri: string, type: string, name: string}|File
    synchronizeInstances(config: { keyChanged: (key: string, data: any) => void }): void
}

export = StorageProvider;
