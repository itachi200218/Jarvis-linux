import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:8000",
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
