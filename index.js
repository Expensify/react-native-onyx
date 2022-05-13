import Onyx from './lib/Onyx';
import withOnyxWithoutStorage from './lib/withOnyx';
import Storage from './lib/storage';

const OnyxWithReactNativeStorage = Onyx(Storage);

export default OnyxWithReactNativeStorage;
export const withOnyx = withOnyxWithoutStorage(OnyxWithReactNativeStorage);
