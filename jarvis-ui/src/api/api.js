import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:8000",
  // baseURL: "https://spvp0vrq-8000.inc1.devtunnels.ms",
});

// attach token automatically
API.interceptors.request.use((req) => {
  const token = sessionStorage.getItem("jarvis_token");
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

export default API;
