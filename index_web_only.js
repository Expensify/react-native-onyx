import Onyx from './lib/Onyx';
import withOnyxWithoutStorage from './lib/withOnyx';
import WebStorage from './lib/storage/WebStorage';

const OnyxWithWebStorageOnly = Onyx(WebStorage);

export default OnyxWithWebStorageOnly;
export const withOnyx = withOnyxWithoutStorage(OnyxWithWebStorageOnly);
