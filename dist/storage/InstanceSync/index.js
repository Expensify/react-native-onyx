"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const noop_1 = __importDefault(require("lodash/noop"));
/**
 *  This is used to keep multiple browser tabs in sync, therefore only needed on web
 *  On native platforms, we omit this syncing logic by setting this to mock implementation.
 */
const InstanceSync = {
    shouldBeUsed: false,
    init: noop_1.default,
    setItem: noop_1.default,
    removeItem: noop_1.default,
    removeItems: noop_1.default,
    multiMerge: noop_1.default,
    multiSet: noop_1.default,
    mergeItem: noop_1.default,
    clear: (callback) => Promise.resolve(callback()),
};
exports.default = InstanceSync;
