const createNodeConfig = require('../../packages/config/eslint/node.cjs');

module.exports = createNodeConfig({ tsconfigPath: __dirname + '/tsconfig.json' });
