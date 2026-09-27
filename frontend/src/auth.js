import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const TOKEN_KEY = 'smr_auth_token';

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setAuthToken(token) {
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }

  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function login(email, password) {
  const { data } = await axios.post(
    `${API_BASE}/auth/login`,
    {
      email,
      password
    }
  );

  if (!data?.ok || !data?.token) {
    throw new Error(
      data?.error || 'Login failed.'
    );
  }

  setAuthToken(data.token);

  return data;
}

export async function register(
  email,
  password,
  name = ''
) {
  const { data } = await axios.post(
    `${API_BASE}/auth/register`,
    {
      email,
      password,
      name
    }
  );

  if (!data?.ok || !data?.token) {
    throw new Error(
      data?.error || 'Registration failed.'
    );
  }

  setAuthToken(data.token);

  return data;
}

export async function getCurrentUser() {
  const token = getAuthToken();

  if (!token) {
    return null;
  }

  try {
    const { data } = await axios.get(
      `${API_BASE}/auth/me`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    return data?.user || null;
  } catch (error) {
    if (
      error?.response?.status === 401
    ) {
      clearAuthToken();
    }

    return null;
  }
}

export function authHeaders() {
  const token = getAuthToken();

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`
  };
}

export function logout() {
  clearAuthToken();
}
