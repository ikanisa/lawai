import { describe, expect, it } from 'vitest';
import { determineBindingLanguage } from '../src/agent.js';
describe('determineBindingLanguage', () => {
    it('flags Swiss sources as multilingual when using fedlex', () => {
        const info = determineBindingLanguage(null, 'https://www.fedlex.admin.ch/eli/cc/27/317_321_377/fr');
        expect(info.jurisdiction).toBe('CH');
        expect(info.bindingLang).toBe('fr/de/it');
        expect(info.translationNotice).toContain('versions française et allemande');
    });
    it('applies Canadian bilingual rule via jurisdiction hint', () => {
        const info = determineBindingLanguage('CA-QC');
        expect(info.jurisdiction).toBe('CA-QC');
        expect(info.translationNotice).toContain('valeur juridique');
        expect(info.requiresBanner).toBe(false);
    });
});
