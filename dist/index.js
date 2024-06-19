"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withOnyx = exports.useOnyx = void 0;
const Onyx_1 = __importDefault(require("./Onyx"));
const useOnyx_1 = __importDefault(require("./useOnyx"));
exports.useOnyx = useOnyx_1.default;
const withOnyx_1 = __importDefault(require("./withOnyx"));
exports.withOnyx = withOnyx_1.default;
exports.default = Onyx_1.default;
