interface ProviderInterface {
    getAllKeys(): Promise<string[]>,
    getItem(key: string): Promise<string|null>,
    multiGet(keys: string[]): Promise<Array<[string, string|null]>>,
    removeItem(key: string): Promise<void>,
    setItem(key: string, value: string): Promise<void>,
    multiSet(pairs: Array<[string, string|null]>): Promise<void>,
    multiMerge(pairs: Array<[string, string|null]>): Promise<void>,
    clear(): Promise<void>,
}

declare const Storage: ProviderInterface;

export = Storage;
