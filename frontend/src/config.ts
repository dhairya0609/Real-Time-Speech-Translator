const DEFAULT_WS_URL = "wss://trilogy-r2.onrender.com";

export const WS_URL = (process.env.REACT_APP_WS_URL || DEFAULT_WS_URL).replace(/\/$/, "");

export const API_URL = (process.env.REACT_APP_API_URL || WS_URL.replace(/^ws(s?):\/\//, "http$1://")).replace(/\/$/, "");
