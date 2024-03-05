/// <reference types="jest" />
import type { KeyValuePairList } from '../providers/types';
declare const idbKeyvalMockSpy: {
    idbKeyvalSet: jest.Mock<Promise<any>, [key: any, value: any]>;
    setItem: jest.Mock<Promise<void | import("react-native-quick-sqlite").QueryResult>, [key: string, value: IDBValidKey]>;
    getItem: jest.Mock<Promise<IDBValidKey | null>, [key: string]>;
    removeItem: jest.Mock<Promise<void | import("react-native-quick-sqlite").QueryResult>, [key: string]>;
    removeItems: jest.Mock<Promise<void | import("react-native-quick-sqlite").QueryResult>, [keys: import("../providers/types").KeyList]>;
    clear: jest.Mock<Promise<void | import("react-native-quick-sqlite").QueryResult>, []>;
    getAllKeys: jest.Mock<Promise<import("../providers/types").KeyList>, []>;
    multiGet: jest.Mock<Promise<KeyValuePairList>, [keys: import("../providers/types").KeyList]>;
    multiSet: jest.Mock<Promise<void | import("react-native-quick-sqlite").BatchQueryResult>, [pairs: KeyValuePairList]>;
    multiMerge: jest.Mock<Promise<import("react-native-quick-sqlite").BatchQueryResult | IDBValidKey[]>, [pairs: KeyValuePairList]>;
    mergeItem: jest.Mock<Promise<void | import("react-native-quick-sqlite").BatchQueryResult>, [key: string, changes: IDBValidKey, modifiedData: IDBValidKey]>;
    getStorageMap: jest.Mock<Record<string, IDBValidKey>, []>;
    setInitialMockData: jest.Mock<void, [data: any]>;
    getDatabaseSize: jest.Mock<Promise<{
        bytesUsed: number;
        bytesRemaining: number;
    }>, []>;
    setMemoryOnlyKeys: jest.Mock<void, []>;
};
export default idbKeyvalMockSpy;
