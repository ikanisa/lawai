const createDenoConfig = require('@avocat-ai/eslint-config/deno');

module.exports = createDenoConfig({
  extraIgnore: ['**/scripts/**']
});
