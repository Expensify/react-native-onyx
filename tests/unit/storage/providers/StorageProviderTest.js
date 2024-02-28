/* eslint-disable import/first */
jest.unmock('../../../../lib/storage/platforms/index.native');
jest.unmock('../../../../lib/storage/platforms/index');
jest.unmock('../../../../lib/storage/providers/IDBKeyValProvider');

import _ from 'underscore';
import NativeStorage from '../../../../lib/storage/platforms/index.native';
import WebStorage from '../../../../lib/storage/platforms/index';
import MemoryOnlyProvider from '../../../../lib/storage/providers/MemoryOnlyProvider';

it('storage providers have same methods implemented', () => {
    const memoryOnlyMethods = _.keys(MemoryOnlyProvider);
    const nativeMethods = _.keys(NativeStorage);
    const webMethods = _.keys(WebStorage);
    const unimplementedMethods = _.difference(nativeMethods, webMethods, memoryOnlyMethods);
    expect(unimplementedMethods.length).toBe(0);
});
