// src/services/api.js
import axios from "axios";
import { getApiBaseUrl } from "../utils/env";

// Set your backend API base URL
const apiBaseUrl = getApiBaseUrl();
console.log("API Base URL:", apiBaseUrl); // Debug log
const API = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000, // 30 second timeout
});

// Automatically add token to headers
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) req.headers.Authorization = `Bearer ${token}`;
  console.log("API Request:", req.method, req.url, "Base URL:", req.baseURL);
  return req;
});

// Response interceptor to handle errors gracefully
API.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      console.error("Request timeout:", error.config?.url);
      return Promise.reject({
        ...error,
        message: "Request timed out. The server is taking too long to respond.",
        isTimeout: true,
      });
    }
    
    // Handle network errors
    if (!error.response) {
      console.error("Network error:", error.message);
      console.error("Request URL:", error.config?.url);
      console.error("Base URL:", error.config?.baseURL);
      console.error("Full error:", error);
      return Promise.reject({
        ...error,
        message: `Network error. Please check your connection. (${error.message || 'Unable to reach server'})`,
        isNetworkError: true,
      });
    }
    
    // Handle 503 (Service Unavailable) - database connection issues
    if (error.response?.status === 503) {
      console.error("Service unavailable:", error.response?.data);
      return Promise.reject({
        ...error,
        message: "Service temporarily unavailable. Please try again in a moment.",
        isServiceUnavailable: true,
      });
    }
    
    // For other errors, return as-is
    return Promise.reject(error);
  }
);

export default API;

