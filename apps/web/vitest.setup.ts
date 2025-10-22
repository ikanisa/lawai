import '@testing-library/jest-dom/vitest';

process.env.NODE_ENV ??= 'test';
process.env.SUPABASE_URL ??= 'https://supabase.localhost';
process.env.SUPABASE_ANON_KEY ??= 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role';

beforeEach(() => {
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
  }
});
