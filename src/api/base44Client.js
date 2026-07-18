import { createClient } from '@base44/sdk';

const appId = import.meta.env.VITE_BASE44_APP_ID;
const appBaseUrl = import.meta.env.VITE_BASE44_APP_BASE_URL || `https://${appId}.base44.app`;

export const base44 = createClient({
  appId,
  appBaseUrl,
  requiresAuth: false,
  serverUrl: '',
});

console.log("Base44 Client Initialized with App ID:", appId);
