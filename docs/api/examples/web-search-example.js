/**
 * Web Search Integration Example
 * 
 * This example demonstrates how to use the web search API endpoints.
 * Run the API server first: pnpm dev:api
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3333';

async function basicWebSearch() {
  console.log('🔍 Running basic web search...\n');
  
  const response = await fetch(`${API_BASE_URL}/api/web-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'What are the latest developments in artificial intelligence?',
    }),
  });

  const result = await response.json();
  
  console.log('Query:', result.query);
  console.log('Text:', result.text.substring(0, 200) + '...');
  console.log('Citations:', result.citations.length);
  console.log('Sources:', result.sources.length);
  console.log('');
}

async function domainFilteredSearch() {
  console.log('🎯 Running domain-filtered search...\n');
  
  const response = await fetch(`${API_BASE_URL}/api/web-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'Recent legal decisions in France',
      allowedDomains: [
        'legifrance.gouv.fr',
        'courdecassation.fr',
        'conseil-etat.fr',
      ],
    }),
  });

  const result = await response.json();
  
  console.log('Query:', result.query);
  console.log('Allowed domains:', ['legifrance.gouv.fr', 'courdecassation.fr', 'conseil-etat.fr']);
  console.log('Citations:', result.citations.length);
  console.log('Sources:', result.sources.map(s => s.url).join(', '));
  console.log('');
}

async function locationRefinedSearch() {
  console.log('📍 Running location-refined search...\n');
  
  const response = await fetch(`${API_BASE_URL}/api/web-search`, {
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

  const result = await response.json();
  
  console.log('Query:', result.query);
  console.log('Location: Paris, France');
  console.log('Text:', result.text.substring(0, 200) + '...');
  console.log('');
}

async function getDomains() {
  console.log('📋 Getting official allowed domains...\n');
  
  const response = await fetch(`${API_BASE_URL}/api/web-search/domains`);
  const result = await response.json();
  
  console.log('Total domains:', result.count);
  console.log('Sample domains:', result.domains.slice(0, 5).join(', '));
  console.log('');
}

async function validateDomains() {
  console.log('✅ Validating domain names...\n');
  
  const response = await fetch(`${API_BASE_URL}/api/web-search/validate-domains`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domains: [
        'example.com',
        'https://test.org',
        'UPPERCASE.COM',
        'invalid domain',
        'http://example.com/path',
      ],
    }),
  });

  const result = await response.json();
  
  console.log('Valid domains:', result.valid);
  console.log('Invalid domains:', result.invalid);
  console.log('');
}

async function main() {
  console.log('🚀 Web Search API Examples\n');
  console.log('='.repeat(50) + '\n');

  try {
    await getDomains();
    await validateDomains();
    
    // Uncomment the following to test actual web searches
    // (requires valid OPENAI_API_KEY environment variable)
    
    // await basicWebSearch();
    // await domainFilteredSearch();
    // await locationRefinedSearch();
    
    console.log('✨ Examples completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', await error.response.text());
    }
  }
}

main();
