import { clientEnv } from '../env.client';

export const API_BASE = clientEnv.NEXT_PUBLIC_API_BASE_URL;
export const CSRF_COOKIE_NAME = '__Host-avocat-csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';
