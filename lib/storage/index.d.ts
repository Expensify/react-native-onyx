interface StorageProvider {
    getAllKeys(): Promise<string[]>,
    getItem<T>(key: string): Promise<string|null>,
    multiGet<T>(keys: string[]): Promise<Array<[string, T|null]>>,
    removeItem(key: string): Promise<void>,
    setItem<T>(key: string, value: T): Promise<void>,
    multiSet<T>(pairs: Array<[string, T|null]>): Promise<void>,
    multiMerge<T>(pairs: Array<[string, T|null]>): Promise<void>,
    clear(): Promise<void>,

    /**
     * Prepares a file so that it can be saved in Onyx.
     * Use this method to make a File reference.
     * Then save it as usual by Onyx.set or Onyx.merge
     * @example
     *
     * Onyx.prepareFile(someFile)
     *     .then(preparedFile => {
     *         Onyx.merge('someKey', {
     *             attachment: preparedFile,
     *             hasAttachment: true,
     *         })
     *     })
     */
    prepareFile(file: any): Promise<{uri: string, type: string, name: string}|File>
}

export = StorageProvider;
