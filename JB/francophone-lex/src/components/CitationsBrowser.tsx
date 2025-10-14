import { useState } from "react";
import { Search, ExternalLink, BookOpen, Calendar, Building, Eye, Download, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

interface Citation {
  id: string;
  title: string;
  source: string;
  publisher: string;
  date: string;
  jurisdiction: string;
  type: "legislation" | "jurisprudence" | "doctrine";
  url: string;
  excerpt?: string;
  isOfficial: boolean;
  isConsolidated?: boolean;
  reliability: "high" | "medium" | "low";
  citationCount: number;
}

const citations: Citation[] = [
  {
    id: "1",
    title: "Code civil français, Article 1134",
    source: "Légifrance",
    publisher: "Ministère de la Justice",
    date: "2023-12-15",
    jurisdiction: "FR",
    type: "legislation",
    url: "https://legifrance.gouv.fr",
    excerpt: "Les conventions légalement formées tiennent lieu de loi à ceux qui les ont faites...",
    isOfficial: true,
    isConsolidated: true,
    reliability: "high",
    citationCount: 2847
  },
  {
    id: "2",
    title: "Arrêt Cour de Cassation, Chambre commerciale, 15 décembre 2023",
    source: "Cour de Cassation",
    publisher: "Cour de Cassation",
    date: "2023-12-15",
    jurisdiction: "FR",
    type: "jurisprudence",
    url: "https://courdecassation.fr",
    excerpt: "La responsabilité contractuelle ne peut être engagée qu'en cas de manquement...",
    isOfficial: true,
    reliability: "high",
    citationCount: 127
  },
  {
    id: "3",
    title: "Acte uniforme OHADA sur le droit commercial général, Article 5",
    source: "OHADA",
    publisher: "Secrétariat Permanent OHADA",
    date: "2023-11-20",
    jurisdiction: "OHADA",
    type: "legislation",
    url: "https://ohada.org",
    excerpt: "Tout commerçant doit tenir un livre-journal présentant...",
    isOfficial: true,
    isConsolidated: true,
    reliability: "high",
    citationCount: 892
  },
  {
    id: "4",
    title: "Code du travail québécois, Section 84",
    source: "Légis Québec",
    publisher: "Gouvernement du Québec",
    date: "2024-01-08",
    jurisdiction: "QC",
    type: "legislation",
    url: "https://legisquebec.gouv.qc.ca",
    excerpt: "L'employeur ne peut congédier, suspendre ou déplacer un salarié...",
    isOfficial: true,
    isConsolidated: true,
    reliability: "high",
    citationCount: 456
  }
];

export function CitationsBrowser() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedJurisdiction, setSelectedJurisdiction] = useState("all");

  const filteredCitations = citations.filter(citation => {
    const matchesSearch = citation.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         citation.excerpt?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === "all" || citation.type === selectedType;
    const matchesJurisdiction = selectedJurisdiction === "all" || citation.jurisdiction === selectedJurisdiction;
    
    return matchesSearch && matchesType && matchesJurisdiction;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "legislation": return <BookOpen className="h-4 w-4" />;
      case "jurisprudence": return <Building className="h-4 w-4" />;
      case "doctrine": return <Eye className="h-4 w-4" />;
      default: return <BookOpen className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "legislation": return "Législation";
      case "jurisprudence": return "Jurisprudence";
      case "doctrine": return "Doctrine";
      default: return type;
    }
  };

  const getReliabilityColor = (reliability: string) => {
    switch (reliability) {
      case "high": return "bg-success/10 text-success border-success/20";
      case "medium": return "bg-warning/10 text-warning border-warning/20";
      case "low": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-muted/10 text-muted-foreground border-muted/20";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Sources et citations</h2>
        </div>
        
        {/* Search */}
        <div className="max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher dans les sources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 glass-surface"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <Tabs value={selectedType} onValueChange={setSelectedType}>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground">
              Type:
            </span>
            <TabsList className="glass-surface">
              <TabsTrigger value="all">Tous</TabsTrigger>
              <TabsTrigger value="legislation">Législation</TabsTrigger>
              <TabsTrigger value="jurisprudence">Jurisprudence</TabsTrigger>
              <TabsTrigger value="doctrine">Doctrine</TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
        
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground">
            Juridiction:
          </span>
          <div className="flex gap-2 flex-wrap">
            {["all", "FR", "BE", "LU", "QC", "OHADA"].map((jurisdiction) => (
              <Button
                key={jurisdiction}
                variant={selectedJurisdiction === jurisdiction ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedJurisdiction(jurisdiction)}
                className="text-xs"
              >
                {jurisdiction === "all" ? "Tous" : jurisdiction}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Citations List */}
      <div className="space-y-4">
        {filteredCitations.map((citation) => (
          <Card key={citation.id} className="glass-surface hover:scale-[1.01] transition-transform">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(citation.type)}
                    <CardTitle className="text-lg leading-tight">
                      {citation.title}
                    </CardTitle>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {citation.jurisdiction}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {getTypeLabel(citation.type)}
                    </Badge>
                    {citation.isOfficial && (
                      <Badge variant="default" className="text-xs bg-success/10 text-success">
                        Officiel
                      </Badge>
                    )}
                    {citation.isConsolidated && (
                      <Badge variant="outline" className="text-xs border-primary/20 text-primary">
                        Consolidé
                      </Badge>
                    )}
                    <Badge 
                      variant="outline" 
                      className={`text-xs border ${getReliabilityColor(citation.reliability)}`}
                    >
                      Fiabilité {citation.reliability}
                    </Badge>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4" />
                    Voir
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building className="h-4 w-4" />
                  <span>{citation.publisher}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(citation.date).toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ExternalLink className="h-4 w-4" />
                  <span>{citation.citationCount} citations</span>
                </div>
              </div>
              
              {citation.excerpt && (
                <>
                  <Separator />
                  <div className="bg-muted/20 rounded-lg p-4">
                    <p className="text-sm italic leading-relaxed font-longform">
                      "{citation.excerpt}"
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCitations.length === 0 && (
        <Card className="glass-surface">
          <CardContent className="p-8 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune source trouvée</h3>
            <p className="text-muted-foreground">
              Essayez de modifier vos critères de recherche ou de sélectionner d'autres filtres.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}