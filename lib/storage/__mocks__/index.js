import WebStorage from '../WebStorage';

export default {
    ...WebStorage,
    clear() {
        console.log('mock clear');
        return WebStorage.clear();
    }

};
