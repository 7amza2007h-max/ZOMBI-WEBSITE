'use strict';
// Keep every dashboard code path on the same normalized guild configuration.
// The old duplicated public/guildStore.js had drifted from the root store and
// could silently drop newer settings (welcome, auto-role, rules and panel media).
module.exports = require('../guildStore');
