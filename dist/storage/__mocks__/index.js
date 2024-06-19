"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const MemoryOnlyProvider_1 = __importStar(require("../providers/MemoryOnlyProvider"));
const init = jest.fn(MemoryOnlyProvider_1.default.init);
init();
const StorageMock = {
    init,
    getItem: jest.fn(MemoryOnlyProvider_1.default.getItem),
    multiGet: jest.fn(MemoryOnlyProvider_1.default.multiGet),
    setItem: jest.fn(MemoryOnlyProvider_1.default.setItem),
    multiSet: jest.fn(MemoryOnlyProvider_1.default.multiSet),
    mergeItem: jest.fn(MemoryOnlyProvider_1.default.mergeItem),
    multiMerge: jest.fn(MemoryOnlyProvider_1.default.multiMerge),
    removeItem: jest.fn(MemoryOnlyProvider_1.default.removeItem),
    removeItems: jest.fn(MemoryOnlyProvider_1.default.removeItems),
    clear: jest.fn(MemoryOnlyProvider_1.default.clear),
    getAllKeys: jest.fn(MemoryOnlyProvider_1.default.getAllKeys),
    getDatabaseSize: jest.fn(MemoryOnlyProvider_1.default.getDatabaseSize),
    keepInstancesSync: jest.fn(),
    mockSet: MemoryOnlyProvider_1.mockSet,
    getMockStore: jest.fn(() => MemoryOnlyProvider_1.mockStore),
    setMockStore: jest.fn((data) => (0, MemoryOnlyProvider_1.setMockStore)(data)),
};
exports.default = StorageMock;
