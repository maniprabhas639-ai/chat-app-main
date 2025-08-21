// Uses your existing axios instance: src/api/http.js
import { http } from './http';

export const getHealth = () => http.get('/health'); // -> { ok: true }
