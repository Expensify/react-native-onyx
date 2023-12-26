/* eslint-disable import/first */
jest.unmock('../../../../lib/storage/NativeStorage');
jest.unmock('../../../../lib/storage/WebStorage');
jest.unmock('../../../../lib/storage/providers/IDBKeyVal');

import _ from 'underscore';
import MemoryOnlyProvider from '../../../../lib/storage/providers/MemoryOnlyProvider';
import NativeStorage from '../../../../lib/storage/NativeStorage';
import WebStorage from '../../../../lib/storage/WebStorage';

it('storage providers have same methods implemented', () => {
    const memoryOnlyMethods = _.keys(MemoryOnlyProvider);
    const nativeMethods = _.keys(NativeStorage);
    const webMethods = _.keys(WebStorage);
    const unimplementedMethods = _.difference(nativeMethods, webMethods, memoryOnlyMethods);
    expect(unimplementedMethods.length).toBe(0);
});
