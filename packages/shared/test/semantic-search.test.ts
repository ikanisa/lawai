import { describe, it, expect } from 'vitest';
import {
  SearchRequestSchema,
  createComparisonFilter,
  createCompoundFilter,
  formatSearchResultsForLLM,
  type SearchResult,
} from '@avocat-ai/shared';

describe('Semantic Search Schemas', () => {
  describe('SearchRequestSchema', () => {
    it('should validate a basic search request', () => {
      const request = {
        query: 'contract execution requirements',
        max_num_results: 10,
      };

      const result = SearchRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query).toBe('contract execution requirements');
        expect(result.data.max_num_results).toBe(10);
      }
    });

    it('should apply default max_num_results', () => {
      const request = {
        query: 'test query',
      };

      const result = SearchRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.max_num_results).toBe(10);
      }
    });

    it('should reject empty query', () => {
      const request = {
        query: '',
        max_num_results: 5,
      };

      const result = SearchRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject max_num_results > 50', () => {
      const request = {
        query: 'test',
        max_num_results: 100,
      };

      const result = SearchRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should validate with all optional fields', () => {
      const request = {
        query: 'test query',
        max_num_results: 20,
        rewrite_query: true,
        attribute_filter: {
          type: 'eq' as const,
          key: 'jurisdiction',
          value: 'OHADA',
        },
        ranking_options: {
          ranker: 'auto' as const,
          score_threshold: 0.75,
        },
      };

      const result = SearchRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });

  describe('Attribute Filters', () => {
    it('should create comparison filter', () => {
      const filter = createComparisonFilter('region', 'eq', 'us');
      
      expect(filter.type).toBe('eq');
      expect(filter.key).toBe('region');
      expect(filter.value).toBe('us');
    });

    it('should create compound filter with AND', () => {
      const filter1 = createComparisonFilter('region', 'eq', 'us');
      const filter2 = createComparisonFilter('date', 'gte', 1672531200);
      const compound = createCompoundFilter('and', [filter1, filter2]);
      
      expect(compound.type).toBe('and');
      expect(compound.filters).toHaveLength(2);
    });

    it('should create nested compound filter', () => {
      const filter1 = createComparisonFilter('region', 'eq', 'us');
      const filter2 = createComparisonFilter('region', 'eq', 'eu');
      const regionFilter = createCompoundFilter('or', [filter1, filter2]);
      
      const dateFilter = createComparisonFilter('date', 'gte', 1672531200);
      const finalFilter = createCompoundFilter('and', [regionFilter, dateFilter]);
      
      expect(finalFilter.type).toBe('and');
      expect(finalFilter.filters).toHaveLength(2);
      expect((finalFilter.filters[0] as any).type).toBe('or');
    });

    it('should support in operator', () => {
      const filter = createComparisonFilter('category', 'in', ['Marketing', 'Sales', 'Legal']);
      
      expect(filter.type).toBe('in');
      expect(Array.isArray(filter.value)).toBe(true);
      expect((filter.value as any[]).length).toBe(3);
    });
  });

  describe('Result Formatting', () => {
    it('should format results for LLM', () => {
      const results: SearchResult[] = [
        {
          file_id: 'file-123',
          filename: 'contract_law.txt',
          score: 0.85,
          attributes: { region: 'US' },
          content: [
            { type: 'text', text: 'First chunk of text' },
            { type: 'text', text: 'Second chunk of text' },
          ],
        },
        {
          file_id: 'file-456',
          filename: 'case_study.pdf',
          score: 0.72,
          content: [
            { type: 'text', text: 'Another relevant passage' },
          ],
        },
      ];

      const formatted = formatSearchResultsForLLM(results);
      
      expect(formatted).toContain('<sources>');
      expect(formatted).toContain('</sources>');
      expect(formatted).toContain("file_id='file-123'");
      expect(formatted).toContain("file_name='contract_law.txt'");
      expect(formatted).toContain("score='0.85'");
      expect(formatted).toContain('<content>First chunk of text</content>');
      expect(formatted).toContain('<content>Second chunk of text</content>');
      expect(formatted).toContain("file_id='file-456'");
    });
  });
});
