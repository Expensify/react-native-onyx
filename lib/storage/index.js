/**
 * On Web and Desktop it's enough to leave everything to localforage
 */

import Storage from './providers/LocalForage';

const instance = new Storage();

export default instance;
