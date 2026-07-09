/**
 * NOTE: This is a compiled file. DO NOT directly edit this file.
 */
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 177:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

/*
 *  NOTE: After changes to the file it needs to be compiled using [`ncc`](https://github.com/vercel/ncc)
 *  Example: ncc build -t validatePRChecklist.ts -o index.js
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
const fs = __importStar(__nccwpck_require__(147));
const path = __importStar(__nccwpck_require__(17));
const UNCHECKED_PATTERN = /- \[ \]/g;
const CHECKED_PATTERN = /- \[x\]/gi;
const E_APP_PR_URL_PATTERN = /^https?:\/\/github\.com\/Expensify\/App\/pull\/\d+\/?$/;
function getAuthorChecklistSection(body) {
    const startMarker = '### Author Checklist';
    const endMarker = '### Screenshots/Videos';
    const startIndex = body.indexOf(startMarker);
    if (startIndex === -1) {
        return '';
    }
    const afterStart = startIndex + startMarker.length;
    const endIndex = body.indexOf(endMarker, afterStart);
    return endIndex === -1 ? body.substring(afterStart) : body.substring(afterStart, endIndex);
}
function getExpectedChecklistCount() {
    const templatePath = path.resolve(process.env.GITHUB_WORKSPACE || '.', '.github/PULL_REQUEST_TEMPLATE.md');
    const template = fs.readFileSync(templatePath, 'utf8');
    const checklistSection = getAuthorChecklistSection(template);
    return (checklistSection.match(/- \[ \]/g) || []).length;
}
function getSectionContent(body, sectionName) {
    const match = body.match(new RegExp(`### ${sectionName}\\s*\\n([\\s\\S]*?)(?=###|$)`));
    return (match?.[1] || '').replace(/<!-[\s\S]*?->/g, '').trim();
}
function validateChecklist(body) {
    const errors = [];
    const warnings = [];
    const checklistSection = getAuthorChecklistSection(body);
    if (!checklistSection.trim()) {
        return {
            errors: ['Author Checklist section not found. Please use the PR template.'],
            warnings: [],
            stats: { expected: 0, found: 0, checked: 0, unchecked: 0 },
        };
    }
    const unchecked = (checklistSection.match(UNCHECKED_PATTERN) || []).length;
    const checked = (checklistSection.match(CHECKED_PATTERN) || []).length;
    const found = unchecked + checked;
    const expected = getExpectedChecklistCount();
    if (found < expected) {
        errors.push(`Found ${found} checklist item(s) but expected at least ${expected}. It looks like items may have been removed. Please use the full PR template.`);
    }
    if (unchecked > 0) {
        errors.push(`${unchecked} checklist item(s) are unchecked. All items must be checked before merging — including items that don't apply (check them and note why if needed).`);
    }
    const linkedEAppPR = getSectionContent(body, 'Linked E/App PR');
    if (!linkedEAppPR) {
        errors.push('The "Linked E/App PR" section is empty. Every Onyx PR must link to a corresponding Expensify/App PR that pins this PR via git+https and runs the full E/App test suite.');
    }
    else if (!E_APP_PR_URL_PATTERN.test(linkedEAppPR)) {
        errors.push(`The "Linked E/App PR" section must contain a single Expensify/App PR URL (e.g. https://github.com/Expensify/App/pull/12345), found: "${linkedEAppPR}".`);
    }
    // Section warnings
    if (!getSectionContent(body, 'Automated Tests')) {
        warnings.push('The "Automated Tests" section is empty. Please describe the automated tests you added, or explain why automated tests are not needed for this change.');
    }
    if (!getSectionContent(body, 'Manual Tests')) {
        warnings.push('The "Manual Tests" section is empty. Please describe how you manually tested this change.');
    }
    const issues = getSectionContent(body, 'Related Issues');
    if (issues === 'GH_LINK' || !issues) {
        warnings.push('The "Related Issues" section still contains the GH_LINK placeholder or is empty. Please replace it with the actual GitHub issue link.');
    }
    return { errors, warnings, stats: { expected, found, checked, unchecked } };
}
function buildSummary(result) {
    const parts = [];
    if (result.errors.length > 0) {
        parts.push('## PR Checklist Validation Failed\n');
        parts.push('### Errors\n');
        result.errors.forEach((e) => parts.push(`- ${e}`));
    }
    if (result.warnings.length > 0) {
        parts.push('\n### Warnings\n');
        result.warnings.forEach((w) => parts.push(`- ${w}`));
    }
    parts.push('\n### Checklist Stats\n');
    parts.push('| Metric | Value |');
    parts.push('|--------|-------|');
    parts.push(`| Expected items | ${result.stats.expected} |`);
    parts.push(`| Found items | ${result.stats.found} |`);
    parts.push(`| Checked | ${result.stats.checked} |`);
    parts.push(`| Unchecked | ${result.stats.unchecked} |`);
    return parts.join('\n');
}
async function run() {
    try {
        const body = github.context.payload.pull_request?.body || '';
        const result = validateChecklist(body);
        result.warnings.forEach((w) => core.warning(w));
        if (result.errors.length > 0 || result.warnings.length > 0) {
            core.summary.addRaw(buildSummary(result));
            await core.summary.write();
        }
        if (result.errors.length > 0) {
            core.setFailed(result.errors.join('\n'));
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


/***/ }),

/***/ 147:
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),

/***/ 17:
/***/ ((module) => {

"use strict";
module.exports = require("path");

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
/******/ 	var __webpack_exports__ = __nccwpck_require__(177);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
