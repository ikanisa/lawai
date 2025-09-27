# Data Residency & Lawful Basis Matrix

| Residency Zone | Jurisdictions / Tenants | Storage Location | Vector Store | Lawful Basis | Additional Controls |
| --- | --- | --- | --- | --- | --- |
| EU / EEA | France, Belgium, Luxembourg, Monaco, EU overlays | Supabase EU region (`authorities-eu`, `uploads-eu`) | OpenAI vector store partition `authorities-francophone-eu` | GDPR Art. 6(1)(f) legitimate interest; DPA executed | SCCs with OpenAI, encryption at rest, audit logging |
| Switzerland | Swiss francophone cantons | Supabase CH project (`authorities-ch`) | Dedicated vector store `authorities-ch` | Swiss FADP legitimate interest | Swiss hosting confirmation, cantonal disclosure |
| Canada (Québec) | Québec and Canadian matters | Supabase CA region (`authorities-ca`) | Vector store `authorities-ca` | PIPEDA / Québec Law 25 consent (client contract) | Residency lock, bilingual notices |
| OHADA (West/Central Africa) | 17 OHADA member states | Supabase EU (public law) + optional national storage via encrypted bucket | Vector store `authorities-ohada` | Legitimate interest + contractual necessity | OHADA compliance clause, CCJA provenance logs |
| Maghreb | Morocco, Tunisia, Algeria | Supabase EU (due to official translation availability) | Vector store `authorities-maghreb` | Legitimate interest; local consent when ingesting translations | Translation banner, Arabic binding disclaimer |
| Rwanda | Rwanda public sector | Supabase deployment in region (if required) | Vector store `authorities-rw` | Rwanda Law 058/2021 consent/contract | Data processing addendum, opt-in encrypted cache |

## Operational Notes
- Confidential client uploads (`uploads-*`) mirror residency zone selection via `org_policies.residency_zone`.
- Performance snapshots reference residency zone to ensure comparisons remain jurisdictionally compliant.
- Update this matrix when onboarding new regions; link the latest version in FRIA artefacts and customer contracts.
