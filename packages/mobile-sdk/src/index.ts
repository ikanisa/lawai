/**
 * Avocat-AI Mobile SDK
 * 
 * Mobile SDK for React Native and Expo applications
 * Provides authentication, API client, and storage helpers
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface MobileSDKConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiBaseUrl?: string;
  storage?: any; // AsyncStorage instance
}

export class AvocatAIMobileSDK {
  private supabase: SupabaseClient;
  private apiBaseUrl: string;

  constructor(config: MobileSDKConfig) {
    const { supabaseUrl, supabaseAnonKey, apiBaseUrl, storage } = config;

    // Initialize Supabase client with optional storage
    this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: storage, // Use AsyncStorage for React Native
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });

    this.apiBaseUrl = apiBaseUrl || 'https://api.avocat-ai.com';
  }

  /**
   * Get the Supabase client instance
   */
  getSupabase() {
    return this.supabase;
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(`Sign in failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string, metadata?: Record<string, any>) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });

    if (error) {
      throw new Error(`Sign up failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Sign out the current user
   */
  async signOut() {
    const { error } = await this.supabase.auth.signOut();

    if (error) {
      throw new Error(`Sign out failed: ${error.message}`);
    }
  }

  /**
   * Get the current session
   */
  async getSession() {
    const { data, error } = await this.supabase.auth.getSession();

    if (error) {
      throw new Error(`Failed to get session: ${error.message}`);
    }

    return data.session;
  }

  /**
   * Get the current user
   */
  async getUser() {
    const { data, error } = await this.supabase.auth.getUser();

    if (error) {
      throw new Error(`Failed to get user: ${error.message}`);
    }

    return data.user;
  }

  /**
   * Make an authenticated API request
   */
  async apiRequest<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const session = await this.getSession();

    if (!session) {
      throw new Error('No active session');
    }

    const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: { access_token: string; user: any } | null) => void) {
    return this.supabase.auth.onAuthStateChange(callback);
  }
}

// Export types
export type Session = Awaited<ReturnType<AvocatAIMobileSDK['getSession']>>;
export type User = Awaited<ReturnType<AvocatAIMobileSDK['getUser']>>;

// Default export
export default AvocatAIMobileSDK;
