import fs from 'fs';
import jsdoc2md from 'jsdoc-to-markdown';

jsdoc2md.render({files: 'dist/Onyx.js'}).then((docs) => {
    let heading = '<!---These docs were automatically generated. Do not edit them directly run `npm run build:docs` script-->\n\n# API Reference\n\n';
    heading += docs;
    fs.writeFileSync('API.md', heading);
});

jsdoc2md.render({files: 'dist/OnyxUtils.js'}).then((docs) => {
    let heading = '<!---These docs were automatically generated. Do not edit them directly run `npm run build:docs` script-->\n\n# Internal API Reference\n\n';
    heading += docs;
    fs.writeFileSync('API-INTERNAL.md', heading);
});
