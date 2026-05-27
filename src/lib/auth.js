import { apiFetch, clearToken, getToken, setToken } from './api';

const DOMAIN = '@damvyeorak.local';

let currentUser = null;

export function toEmail(id) {
  return `${String(id).trim()}${DOMAIN}`;
}

export function toId(email = '') {
  return email.endsWith(DOMAIN) ? email.slice(0, -DOMAIN.length) : email;
}

export function authUserFromProfile(profile) {
  if (!profile) return null;
  return {
    uid: profile.uid,
    email: toEmail(profile.id),
    displayName: profile.displayName
  };
}

export function notifyAuthChanged() {
  window.dispatchEvent(new Event('auth-changed'));
}

export async function login(id, password) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: { id: String(id).trim(), password }
  });
  setToken(data.token);
  currentUser = data.user;
  notifyAuthChanged();
  return { user: authUserFromProfile(data.user), profile: data.user };
}

export async function logout() {
  try {
    if (getToken()) {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    }
  } finally {
    clearToken();
    currentUser = null;
    notifyAuthChanged();
  }
}

export async function getCurrentProfile() {
  if (!getToken()) return null;
  const data = await apiFetch('/api/auth/me');
  currentUser = data.user;
  return currentUser;
}

export function makePassword(length = 8) {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function createUser(id, password, role, extraData = {}) {
  const data = await apiFetch('/api/users', {
    method: 'POST',
    body: {
      id,
      password,
      role,
      ...extraData
    }
  });
  return authUserFromProfile(data.user);
}
