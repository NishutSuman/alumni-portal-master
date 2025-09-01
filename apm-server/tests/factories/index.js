// tests/factories/index.js
/**
 * Central export point for all test factories
 * This file resolves the "Cannot find module '../../../factories'" error
 */

const UserFactory = require("./user.factory.js");
const AuthFactory = require("./auth.factory.js");

module.exports = {
	UserFactory,
	AuthFactory,
};
