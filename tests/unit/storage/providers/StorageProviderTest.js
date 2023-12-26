/* eslint-disable import/first */
jest.unmock('../../../../lib/storage/platforms/NativeStorage');
jest.unmock('../../../../lib/storage/platforms/WebStorage');
jest.unmock('../../../../lib/storage/providers/IDBKeyValProvider');

import _ from 'underscore';
import MemoryOnlyProvider from '../../../../lib/storage/providers/MemoryOnlyProvider';
import NativeStorage from '../../../../lib/storage/platforms/NativeStorage';
import WebStorage from '../../../../lib/storage/platforms/WebStorage';

it('storage providers have same methods implemented', () => {
    const memoryOnlyMethods = _.keys(MemoryOnlyProvider);
    const nativeMethods = _.keys(NativeStorage);
    const webMethods = _.keys(WebStorage);
    const unimplementedMethods = _.difference(nativeMethods, webMethods, memoryOnlyMethods);
    expect(unimplementedMethods.length).toBe(0);
});
