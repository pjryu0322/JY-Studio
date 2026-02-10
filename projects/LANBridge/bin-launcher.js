#!/usr/bin/env node
/**
 * LANBridge Launcher Entry Point
 * This file packages the launcher.js as a standalone executable
 */

const path = require('path');
process.argv.unshift('launcher.js');

// Change to app directory
process.chdir(__dirname);

// Load launcher.js
require('./launcher.js');
