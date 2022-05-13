import Onyx from './lib/Onyx';
import withOnyx from './lib/withOnyx';
import Storage from './lib/storage';

const OnyxWithReactNativeStorage = Onyx(Storage);
const withOnyxUsingReactNativeStorage = withOnyx(OnyxWithReactNativeStorage);

export default OnyxWithReactNativeStorage;
export {withOnyxUsingReactNativeStorage};
