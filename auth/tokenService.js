const axios = require('axios');

const AUTH_API_URL = 'http://20.207.122.201/evaluation-service/auth';

let cachedToken = null;
let expiresAtMs = 0;

function hasToken() {
  return Boolean(cachedToken) && Date.now() < expiresAtMs;
}

function readCredentialEnv() {
  return {
    email: process.env.AUTH_EMAIL,
    name: process.env.AUTH_NAME,
    mobileNo: process.env.AUTH_MOBILE_NO,
    githubUsername: process.env.AUTH_GITHUB_USERNAME,
    rollNo: process.env.AUTH_ROLL_NO,
    accessCode: process.env.AUTH_ACCESS_CODE,
    clientID: process.env.AUTH_CLIENT_ID,
    clientSecret: process.env.AUTH_CLIENT_SECRET
  };
}

function validateCredentials(credentials) {
  const missing = Object.entries(credentials)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return missing;
}

async function fetchTokenFromServer() {
  const credentials = readCredentialEnv();
  const missing = validateCredentials(credentials);

  if (missing.length > 0) {
    throw new Error(
      `Missing auth configuration: ${missing.join(', ')}. Fill .env (or set AUTH_TOKEN directly).`
    );
  }

  const response = await axios.post(AUTH_API_URL, credentials);
  const tokenType = response.data.token_type || 'Bearer';
  const accessToken = response.data.access_token;
  const expiresIn = Number(response.data.expires_in || 3600);

  if (!accessToken) {
    throw new Error('Auth API did not return access_token');
  }

  cachedToken = `${tokenType} ${accessToken}`;
  expiresAtMs = Date.now() + Math.max(30, expiresIn - 30) * 1000;

  return cachedToken;
}

async function getAccessToken() {
  if (process.env.AUTH_TOKEN && process.env.AUTH_TOKEN.trim()) {
    const raw = process.env.AUTH_TOKEN.trim();
    return raw.toLowerCase().startsWith('bearer ') ? raw : `Bearer ${raw}`;
  }

  if (hasToken()) {
    return cachedToken;
  }

  return fetchTokenFromServer();
}

module.exports = {
  getAccessToken
};
