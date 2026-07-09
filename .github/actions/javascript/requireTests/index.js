/**
 * NOTE: This is a compiled file. DO NOT directly edit this file.
 */
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 509:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

/*
 *  NOTE: After changes to the file it needs to be compiled using [`ncc`](https://github.com/vercel/ncc)
 *  Example: ncc build -t requireTests.ts -o index.js
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
Object.defineProperty(exports, "__esModule", ({ value: true }));
const core = __importStar(__nccwpck_require__(396));
const github = __importStar(__nccwpck_require__(716));
async function run() {
    try {
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            core.setFailed('GITHUB_TOKEN is not set.');
            return;
        }
        const { owner, repo } = github.context.repo;
        const pullNumber = github.context.payload.pull_request.number;
        const octokit = github.getOctokit(token);
        // Fetch all changed files (handles pagination for large PRs)
        const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
            owner,
            repo,
            pull_number: pullNumber,
            per_page: 100,
        });
        const changedFileNames = files.map((file) => file.filename);
        // Identify source file changes in lib/ (excluding types, .d.ts, and mocks)
        const sourceFiles = changedFileNames.filter((filename) => filename.startsWith('lib/') &&
            (filename.endsWith('.ts') || filename.endsWith('.tsx')) &&
            !filename.endsWith('.d.ts') &&
            !filename.startsWith('lib/types/') &&
            !filename.includes('__mocks__'));
        // Identify test file changes in tests/
        const testFiles = changedFileNames.filter((filename) => filename.startsWith('tests/') && (filename.endsWith('.ts') || filename.endsWith('.tsx')));
        // If source files changed but no test files changed, fail
        if (sourceFiles.length > 0 && testFiles.length === 0) {
            const fileList = sourceFiles.map((filename) => `- \`${filename}\``).join('\n');
            const summary = `## Tests Required\n\nThis PR modifies source files in \`lib/\` but does not include any test file changes in \`tests/\`.\n\n**Changed source files:**\n${fileList}\n\nPlease add or update tests to cover these changes.`;
            core.summary.addRaw(summary);
            await core.summary.write();
            core.setFailed(`This PR modifies ${sourceFiles.length} source file(s) in lib/ but no test files were added or modified. Please add or update tests to cover the changes.`);
        }
        else if (sourceFiles.length > 0 && testFiles.length > 0) {
            core.info(`Source files changed: ${sourceFiles.length}, test files changed: ${testFiles.length}. Looks good!`);
        }
        else {
            core.info('No source files in lib/ were changed. Test requirement check passed.');
        }
    }
    catch (error) {
        core.setFailed(error.message);
    }
}
void run();


/***/ }),

/***/ 396:
/***/ ((module) => {

module.exports = eval("require")("@actions/core");


/***/ }),

/***/ 716:
/***/ ((module) => {

module.exports = eval("require")("@actions/github");


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
/******/ 	var __webpack_exports__ = __nccwpck_require__(509);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
