"use client";

import type { ResearchCitation } from "@/lib/data/research";

import { EvidencePane } from "@/components/evidence/EvidencePane";

interface EvidenceSidebarProps {
  citations: ResearchCitation[];
  onCitationClick: (citation: ResearchCitation) => void;
}

export function EvidenceSidebar({ citations, onCitationClick }: EvidenceSidebarProps) {
  return <EvidencePane citations={citations} onCitationClick={onCitationClick} />;
}
