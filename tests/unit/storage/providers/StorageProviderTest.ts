/* eslint-disable import/first */
jest.unmock('../../../../lib/storage/platforms/index.native');
jest.unmock('../../../../lib/storage/platforms/index');

import NativeStorage from '../../../../lib/storage/platforms/index.native';
import WebStorage from '../../../../lib/storage/platforms/index';

it('storage providers have same methods implemented', () => {
    const nativeMethods = Object.keys(NativeStorage);
    const webMethods = Object.keys(WebStorage);
    const unimplementedMethods = nativeMethods.filter((method) => !webMethods.includes(method));
    expect(unimplementedMethods.length).toBe(0);
});
