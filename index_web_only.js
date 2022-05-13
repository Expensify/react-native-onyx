import Onyx from './lib/Onyx';
import withOnyx from './lib/withOnyx';
import WebStorage from './lib/storage/WebStorage';

const OnyxWithWebStorageOnly = Onyx(WebStorage);
const withOnyxUsingWebStorageOnly = withOnyx(OnyxWithWebStorageOnly);

export default OnyxWithWebStorageOnly;
export {withOnyxUsingWebStorageOnly};
