import fs from 'fs';
import jsdoc2md from 'jsdoc-to-markdown';

// jsdoc's fallback config excludes any path with a segment starting with "_", which drops every file when the
// checkout lives under such a directory (e.g. Blacksmith runners use /home/runner/_work), so pass an explicit config.
const configure = 'jsdoc.json';

jsdoc2md.render({files: 'dist/Onyx.js', configure}).then((docs) => {
    let heading = '<!---These docs were automatically generated. Do not edit them directly run `npm run build:docs` script-->\n\n# API Reference\n\n';
    heading += docs;
    fs.writeFileSync('API.md', heading);
});

jsdoc2md.render({files: 'dist/OnyxUtils.js', configure}).then((docs) => {
    let heading = '<!---These docs were automatically generated. Do not edit them directly run `npm run build:docs` script-->\n\n# Internal API Reference\n\n';
    heading += docs;
    fs.writeFileSync('API-INTERNAL.md', heading);
});
