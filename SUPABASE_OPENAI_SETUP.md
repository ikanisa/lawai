# Supabase OpenAI Integration

## Overview

OpenAI is already configured in your Supabase project. The application is now set up to use the OpenAI API key from Supabase.

## Configuration

The application will automatically look for the OpenAI API key in this order:

1. **Supabase Secrets** (if using Supabase Edge Functions)
2. **Environment Variables** (`OPENAI_API_KEY` or `SUPABASE_OPENAI_API_KEY`)
3. **Supabase Vault** (if configured)

## Setting Up OpenAI in Supabase

### Option 1: Supabase Secrets (Recommended)

If you're using Supabase Edge Functions, you can store the OpenAI API key as a secret:

1. Go to your Supabase Dashboard
2. Navigate to **Settings** → **Edge Functions** → **Secrets**
3. Add a new secret:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (starts with `sk-`)

### Option 2: Environment Variables

If you're running the app locally or on a server, you can still use `.env`:

```bash
# .env file
OPENAI_API_KEY="sk-your-key-here"
```

Or if Supabase provides it via environment:

```bash
SUPABASE_OPENAI_API_KEY="sk-your-key-here"
```

### Option 3: Supabase Vault

If you've stored the key in Supabase Vault, it will be automatically accessible to Edge Functions.

## How It Works

The application code (`lib/ai-agent.ts`) automatically detects the OpenAI API key from:

1. `process.env.OPENAI_API_KEY` - Standard environment variable
2. `process.env.SUPABASE_OPENAI_API_KEY` - Supabase-specific variable
3. `process.env.OPENAI_API_KEY_SECRET` - Alternative secret name

## Verification

To verify OpenAI is working:

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Login to the application
3. Try sending a message in the chat interface
4. If configured correctly, you'll get AI responses

## Troubleshooting

### Error: "OpenAI API key not configured"

This means the application can't find the OpenAI API key. Check:

1. **Supabase Dashboard**: Verify the secret is set in Edge Functions → Secrets
2. **Environment Variables**: Check your `.env` file has `OPENAI_API_KEY`
3. **Supabase Vault**: If using Vault, verify the key is accessible

### Error: "Invalid API key"

1. Verify the API key is correct in Supabase
2. Check the key hasn't expired or been revoked
3. Ensure the key has the correct permissions

### Using Supabase Edge Functions

If you want to use Supabase Edge Functions for OpenAI calls:

1. Create an Edge Function in Supabase
2. Store the OpenAI API key as a secret
3. Call the Edge Function from your Next.js app

Example Edge Function structure:
```
supabase/functions/openai-chat/
  index.ts
```

## Current Setup

✅ **Code Updated**: The application now supports Supabase OpenAI integration
✅ **Flexible Configuration**: Works with Supabase secrets or environment variables
✅ **Error Handling**: Graceful fallback if key is not found

## Next Steps

1. **Verify OpenAI Key in Supabase**: Check your Supabase dashboard
2. **Test the Integration**: Try the chat feature
3. **Monitor Usage**: Check OpenAI usage in your dashboard

## Security Notes

- ✅ API keys stored securely in Supabase secrets
- ✅ Never expose API keys in client-side code
- ✅ All OpenAI calls are server-side only
- ✅ Audit logging for all AI interactions
