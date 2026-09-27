import axios from 'axios';
import { authHeaders, getAuthToken } from './auth';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export async function checkToolAccess(toolId) {
  if (!getAuthToken()) {
    return {
      hasAccess: false,
      accessType: null,
      planId: null,
      planName: null,
      expiresAt: null,
      remainingMinutes: 0,
    };
  }

  const { data } = await axios.get(
    `${API_BASE}/access/${encodeURIComponent(toolId)}`,
    {
      headers: authHeaders(),
    }
  );

  return data;
}

export async function createToolOrder(
  toolId,
  planId,
  purpose = 'plan_purchase'
) {
  if (!getAuthToken()) {
    throw new Error(
      'Payment ke liye pehle login karna zaroori hai.'
    );
  }

  const { data } = await axios.post(
    `${API_BASE}/create-order`,
    {
      toolId,
      planId,
      purpose,
    },
    {
      headers: authHeaders(),
    }
  );

  return data;
}

export async function verifyToolPayment(paymentResponse) {
  const { data } = await axios.post(
    `${API_BASE}/verify-payment`,
    paymentResponse,
    {
      headers: authHeaders(),
    }
  );

  return data;
}
