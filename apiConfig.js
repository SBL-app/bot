// API Configuration
// Uses environment variable in production (Docker), falls back to config.json for local development
const config = require('./config.json');

const API_URL = process.env.API_URL || config.apiUrl;

module.exports = { API_URL };
