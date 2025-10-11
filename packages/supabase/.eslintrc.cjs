const createNodeConfig = require('../config/eslint/node.cjs');

module.exports = createNodeConfig({ tsconfigPath: __dirname + '/tsconfig.json' });
