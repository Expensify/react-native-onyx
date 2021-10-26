const fs = require('fs');
const jsdoc2md = require('jsdoc-to-markdown');

// eslint-disable-next-line no-console
jsdoc2md.render({files: 'lib/Onyx.js'}).then((docs) => {
    // eslint-disable-next-line max-len
    let heading = '<!---These docs were automatically generated. Do not edit them directly run `npm run build-docs` script-->\n\n# API Reference\n\n';
    heading += docs;
    fs.writeFileSync('API.md', heading);
});
