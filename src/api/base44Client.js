const appId = import.meta.env.VITE_BASE44_APP_ID;
const appBaseUrl = import.meta.env.VITE_BASE44_APP_BASE_URL;

export const appParams = {
  appId,
  appBaseUrl,
  token: null,           // Base44 will handle this
  functionsVersion: 'v1',
};

console.log("Base44 Config:", { appId, appBaseUrl }); // for debugging
