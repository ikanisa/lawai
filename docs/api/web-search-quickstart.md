# Web Search API - Quick Start

Quick reference guide for using the web search functionality.

## Basic Usage

```bash
curl -X POST http://localhost:3333/api/web-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the latest AI developments?"
  }'
```

## With Domain Filtering

```bash
curl -X POST http://localhost:3333/api/web-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Recent French legal cases",
    "allowedDomains": [
      "legifrance.gouv.fr",
      "courdecassation.fr",
      "conseil-etat.fr"
    ]
  }'
```

## With User Location

```bash
curl -X POST http://localhost:3333/api/web-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Best restaurants near me",
    "userLocation": {
      "type": "approximate",
      "country": "FR",
      "city": "Paris",
      "timezone": "Europe/Paris"
    }
  }'
```

## Cache-Only Mode

```bash
curl -X POST http://localhost:3333/api/web-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Historical event information",
    "externalWebAccess": false
  }'
```

## Response Format

```json
{
  "query": "Your query here",
  "text": "The search result text with inline citations...",
  "citations": [
    {
      "type": "url_citation",
      "start_index": 0,
      "end_index": 50,
      "url": "https://example.com/article",
      "title": "Article Title"
    }
  ],
  "sources": [
    {
      "url": "https://example.com",
      "title": "Example Source"
    }
  ],
  "searchCallId": "ws_123...",
  "action": {
    "type": "search",
    "query": "reformulated query",
    "domains": ["example.com"]
  }
}
```

## Get Available Domains

```bash
curl http://localhost:3333/api/web-search/domains
```

## Validate Domains

```bash
curl -X POST http://localhost:3333/api/web-search/validate-domains \
  -H "Content-Type: application/json" \
  -d '{
    "domains": ["example.com", "test.org", "invalid domain"]
  }'
```

## Key Features

- ✅ Domain filtering (up to 20 domains)
- ✅ Geographic search refinement
- ✅ Live/cache mode toggle
- ✅ Automatic URL citations
- ✅ Complete source list
- ✅ Error handling with specific codes

## Limitations

- Maximum 20 domains in allowlist
- Maximum 2000 characters in query
- Maximum 128K context window
- Not supported in minimal reasoning models

## Full Documentation

See [docs/api/web-search.md](./web-search.md) for complete API documentation.
