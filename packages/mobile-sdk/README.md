# Avocat-AI Mobile SDK

Mobile SDK for integrating Avocat-AI into React Native and Expo applications.

## Installation

```bash
# Using npm
npm install @avocat-ai/mobile-sdk @supabase/supabase-js @react-native-async-storage/async-storage

# Using yarn
yarn add @avocat-ai/mobile-sdk @supabase/supabase-js @react-native-async-storage/async-storage

# Using pnpm
pnpm add @avocat-ai/mobile-sdk @supabase/supabase-js @react-native-async-storage/async-storage
```

## Setup

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AvocatAIMobileSDK } from '@avocat-ai/mobile-sdk';

// Initialize the SDK
const sdk = new AvocatAIMobileSDK({
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseAnonKey: 'your-anon-key',
  apiBaseUrl: 'https://api.avocat-ai.com',
  storage: AsyncStorage, // Required for React Native
});
```

## Usage

### Authentication

```typescript
// Sign in
const { user, session } = await sdk.signIn('user@example.com', 'password');

// Sign up
const { user } = await sdk.signUp('user@example.com', 'password', {
  firstName: 'John',
  lastName: 'Doe',
});

// Sign out
await sdk.signOut();

// Get current session
const session = await sdk.getSession();

// Get current user
const user = await sdk.getUser();

// Listen to auth state changes
const { data } = sdk.onAuthStateChange((event, session) => {
  console.log('Auth event:', event, session);
});

// Unsubscribe when done
data.subscription.unsubscribe();
```

### API Requests

```typescript
// Make authenticated API requests
const response = await sdk.apiRequest('/runs', {
  method: 'POST',
  body: JSON.stringify({
    query: 'What are my rights?',
  }),
});
```

### Direct Supabase Access

```typescript
// Access Supabase client directly for advanced queries
const supabase = sdk.getSupabase();

const { data, error } = await supabase
  .from('matters')
  .select('*')
  .eq('user_id', userId);
```

## Features

- 🔐 Authentication (sign in, sign up, sign out)
- 🔄 Session management with AsyncStorage
- 📡 Authenticated API requests
- 🎣 Auth state change listeners
- 📦 Direct Supabase client access
- 🔒 TypeScript support with full type safety

## Requirements

- React Native >= 0.70.0
- @react-native-async-storage/async-storage >= 1.19.0
- @supabase/supabase-js >= 2.75.0

## License

PROPRIETARY - Not for public distribution
