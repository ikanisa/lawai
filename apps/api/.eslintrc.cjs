const path = require('node:path');
const createNodeConfig = require('@avocat-ai/eslint-config/node');

module.exports = createNodeConfig({ tsconfigPath: path.join(__dirname, 'tsconfig.json') });
