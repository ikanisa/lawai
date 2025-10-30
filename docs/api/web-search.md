# Web Search API

This document describes the web search functionality implemented using OpenAI's Responses API.

## Overview

The web search API allows models to access up-to-date information from the internet and provide answers with sourced citations. It uses OpenAI's `web_search` tool in the Responses API for non-reasoning web search, which is fast and ideal for quick lookups.

## Features

- **Domain Filtering**: Limit search results to specific domains (up to 20)
- **User Location**: Refine search results based on geographic location
- **Live Internet Access Control**: Toggle between live web access and cache-only mode
- **Citations**: Automatic URL citations with start/end positions in the response
- **Sources**: Complete list of URLs consulted during the search

## API Endpoints

### POST /api/web-search

Perform a web search with optional domain filtering and user location.

**Request Body:**

```json
{
  "query": "What was a positive news story from today?",
  "model": "gpt-4o-mini",
  "allowedDomains": ["example.com", "news.org"],
  "userLocation": {
    "type": "approximate",
    "country": "US",
    "city": "New York",
    "region": "New York",
    "timezone": "America/New_York"
  },
  "externalWebAccess": true,
  "maxOutputTokens": 16000
}
```

**Parameters:**

- `query` (string, required): The search query (1-2000 characters)
- `model` (string, optional): OpenAI model to use (default: "gpt-4o-mini")
- `allowedDomains` (array, optional): List of allowed domains (max 20)
- `userLocation` (object, optional): User location for geo-refined results
  - `type`: Always "approximate"
  - `country`: ISO 3166-1 alpha-2 country code (e.g., "US")
  - `city`: City name
  - `region`: Region/state name
  - `timezone`: IANA timezone (e.g., "America/New_York")
- `externalWebAccess` (boolean, optional): Enable live web access (default: true)
- `maxOutputTokens` (number, optional): Maximum output tokens (default: 16000)

**Response:**

```json
{
  "query": "What was a positive news story from today?",
  "text": "On March 6, 2025, several news...",
  "citations": [
    {
      "type": "url_citation",
      "start_index": 2606,
      "end_index": 2758,
      "url": "https://example.com/article",
      "title": "Article Title"
    }
  ],
  "sources": [
    {
      "url": "https://example.com",
      "title": "Example Site"
    }
  ],
  "searchCallId": "ws_67c9fa0502748190b7dd390736892e100be649c1a5ff9609",
  "action": {
    "type": "search",
    "query": "positive news story March 6 2025",
    "domains": ["example.com"],
    "sources": [...]
  }
}
```

**Error Responses:**

- `400 Bad Request`: Invalid request parameters
- `500 Internal Server Error`: Search operation failed

### GET /api/web-search/domains

Get the list of official allowed domains from the system allowlist.

**Response:**

```json
{
  "domains": [
    "legifrance.gouv.fr",
    "courdecassation.fr",
    "conseil-etat.fr",
    ...
  ],
  "count": 24
}
```

### POST /api/web-search/validate-domains

Validate a list of domain names.

**Request Body:**

```json
{
  "domains": [
    "example.com",
    "https://test.org",
    "invalid domain",
    "UPPERCASE.COM"
  ]
}
```

**Response:**

```json
{
  "valid": ["example.com", "test.org", "uppercase.com"],
  "invalid": ["invalid domain"],
  "validCount": 3,
  "invalidCount": 1
}
```

## Usage Examples

### Basic Web Search

```typescript
const response = await fetch('/api/web-search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'Latest developments in AI',
  }),
});

const result = await response.json();
console.log(result.text);
console.log(result.citations);
```

### Domain-Filtered Search

```typescript
const response = await fetch('/api/web-search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'French legal cases',
    allowedDomains: [
      'legifrance.gouv.fr',
      'courdecassation.fr',
      'conseil-etat.fr',
    ],
  }),
});
```

### Location-Refined Search

```typescript
const response = await fetch('/api/web-search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'Best restaurants near me',
    userLocation: {
      type: 'approximate',
      country: 'FR',
      city: 'Paris',
      region: 'Île-de-France',
      timezone: 'Europe/Paris',
    },
  }),
});
```

### Cache-Only Search

```typescript
const response = await fetch('/api/web-search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'Historical event',
    externalWebAccess: false, // Use cached/indexed results only
  }),
});
```

## Implementation Details

### Service Layer

The `performWebSearch` function in `apps/api/src/services/web-search.ts` handles:

1. Input validation
2. OpenAI API request construction with web_search tool
3. Response parsing to extract text, citations, and sources
4. Error handling and logging

### Type Safety

All types are defined in `packages/shared/src/types/web-search.ts` using Zod schemas:

- `WebSearchTool`: Tool configuration
- `UserLocation`: Geographic location parameters
- `URLCitation`: Citation with position in text
- `WebSearchSource`: Source URL information
- `WebSearchResult`: Complete search result

### Domain Validation

The `validateAllowedDomains` function:

- Strips HTTP/HTTPS prefixes
- Normalizes to lowercase
- Validates hostname format
- Rejects invalid domains

## Limitations

- Maximum 20 domains in the allowlist per API constraint
- Maximum 2000 characters in the query
- Web search is not supported in minimal reasoning models
- Context window limited to 128,000 tokens

## Error Codes

- `web_search_invalid_request`: Empty or invalid query
- `web_search_api_error`: OpenAI API error
- `web_search_quota_exceeded`: API quota exceeded
- `web_search_domain_filter_error`: Domain filtering error

## Related Documentation

- [OpenAI Web Search Documentation](https://platform.openai.com/docs/guides/web-search)
- [Domain Allowlist](../../packages/shared/src/constants/allowlist.ts)
- [API Routes](../apps/api/src/routes/web-search/index.ts)
