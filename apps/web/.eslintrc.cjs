const path = require('node:path');
const createNextConfig = require('@avocat-ai/eslint-config/next');

module.exports = createNextConfig({ tsconfigPath: path.join(__dirname, 'tsconfig.json') });
