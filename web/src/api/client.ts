import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL ?? '/api';

export const api = axios.create({
  baseURL
});

export async function get<T>(url: string) {
  const response = await api.get<T>(url);
  return response.data;
}

export async function post<T>(url: string, body?: unknown) {
  const response = await api.post<T>(url, body);
  return response.data;
}

export async function patch<T>(url: string, body?: unknown) {
  const response = await api.patch<T>(url, body);
  return response.data;
}
