/**
 * NOTE: This is a compiled file. DO NOT directly edit this file.
 */
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 919:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

/*
 *  NOTE: After changes to the file it needs to be compiled using [`ncc`](https://github.com/vercel/ncc)
 *  Example: ncc build -t validateReassureOutput.ts -o index.js
 */
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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const core = __importStar(__nccwpck_require__(396));
const fs_1 = __importDefault(__nccwpck_require__(147));
function getInputOrEnv(name) {
    try {
        return core.getInput(name, { required: true });
    }
    catch {
        const envProperty = process.env[name];
        if (!envProperty) {
            throw new Error(`'${name}' env property not defined.`);
        }
        return envProperty;
    }
}
async function run() {
    try {
        const regressionOutput = JSON.parse(fs_1.default.readFileSync('.reassure/output.json', 'utf8'));
        const allowedDurationDeviation = Number(getInputOrEnv('ALLOWED_DURATION_DEVIATION'));
        const durationDeviationPercentage = Number(getInputOrEnv('ALLOWED_RELATIVE_DURATION_DEVIATION'));
        const isValidatingStability = getInputOrEnv('IS_VALIDATING_STABILITY') === 'true';
        if (regressionOutput.significant === undefined || regressionOutput.significant.length === 0) {
            console.log('No significant data available. Exiting...');
            return true;
        }
        const outputs = [];
        console.log(`Processing ${regressionOutput.significant.length} measurements...`);
        for (let i = 0; i < regressionOutput.significant.length; i++) {
            const index = i + 1;
            const measurement = regressionOutput.significant[i];
            const durationDeviation = measurement.durationDiff;
            const relativeDurationDeviation = measurement.relativeDurationDiff;
            const relativeDurationDeviationPercentage = relativeDurationDeviation * 100;
            console.log(`Processing measurement ${index}: ${measurement.name}`);
            const isMeasurementRelevant = Math.abs(durationDeviation) > allowedDurationDeviation;
            if (!isMeasurementRelevant) {
                console.log(`Skipping measurement ${index} as it's not relevant.`);
                continue;
            }
            if (relativeDurationDeviationPercentage > durationDeviationPercentage) {
                outputs.push({
                    name: measurement.name,
                    description: `Duration deviation of ${durationDeviation.toFixed(2)} ms (${relativeDurationDeviationPercentage.toFixed(2)}%) exceeded the allowed range of ${allowedDurationDeviation.toFixed(2)} ms (${durationDeviationPercentage.toFixed(2)}%).`,
                    relativeDurationDeviationPercentage,
                    isDeviationExceeded: true,
                });
            }
            else {
                outputs.push({
                    name: measurement.name,
                    description: `Duration deviation of ${durationDeviation.toFixed(2)} ms (${relativeDurationDeviationPercentage.toFixed(2)}%) is within the allowed range of ${allowedDurationDeviation.toFixed(2)} ms (${durationDeviationPercentage.toFixed(2)}%).`,
                    relativeDurationDeviationPercentage,
                    isDeviationExceeded: false,
                });
            }
        }
        if (outputs.length === 0) {
            console.log('No relevant measurements. Exiting...');
            return true;
        }
        console.log('\nSummary:');
        outputs.sort((a, b) => b.relativeDurationDeviationPercentage - a.relativeDurationDeviationPercentage);
        outputs.forEach((output) => {
            console.log(`${output.isDeviationExceeded ? '🔴' : '🟢'} ${output.name} > ${output.description}`);
        });
        const shouldFailWorkflow = outputs.some((output) => output.isDeviationExceeded);
        if (shouldFailWorkflow) {
            if (isValidatingStability) {
                core.setFailed(`🔴 Duration deviation exceeded the allowed ranges in one or more measurements during the stability checks.`);
            }
            else {
                core.setFailed(`🔴 Duration deviation exceeded the allowed ranges in one or more measurements.`);
            }
        }
        return true;
    }
    catch (error) {
        console.log('error: ', error);
        core.setFailed(error.message);
    }
}
run();
exports["default"] = run;


/***/ }),

/***/ 396:
/***/ ((module) => {

module.exports = eval("require")("@actions/core");


/***/ }),

/***/ 147:
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId].call(module.exports, module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __nccwpck_require__(919);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
