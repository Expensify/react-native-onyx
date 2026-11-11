const {TestEnvironment: JSDOMEnvironment} = require('jest-environment-jsdom');

// We need this custom JSDOM environment implementation in order
// to support `structuredClone` in Jest, that is used by `fake-indexeddb` library.
// Reference: https://github.com/jsdom/jsdom/issues/3363#issuecomment-1467894943
class FixJSDOMEnvironment extends JSDOMEnvironment {
    constructor(...args) {
        super(...args);
        this.global.structuredClone = structuredClone;
    }
}

module.exports = FixJSDOMEnvironment;
