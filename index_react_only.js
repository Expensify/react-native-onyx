import Onyx from './lib/Onyx';
import withOnyx from './lib/withOnyx';
import WebStorage from './lib/storage/WebStorage';

export default Onyx(WebStorage);
export {withOnyx};
