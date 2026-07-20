// The installed `uuid` package ships ESM only, which Jest cannot parse without
// a Babel transform this project does not configure. It reaches the test suite
// transitively (nothing in our own code imports it directly), so mapping it to
// this CommonJS shim keeps the dependency graph loadable under Jest without
// changing anything in production.
const { randomUUID } = require('crypto');

module.exports = {
  v4: randomUUID,
  v1: randomUUID,
  v3: randomUUID,
  v5: randomUUID,
  NIL: '00000000-0000-0000-0000-000000000000',
  validate: (s) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s)),
};
