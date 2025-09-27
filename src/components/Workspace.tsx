import { useState } from "react";
import { HeroSearchBar } from "./HeroSearchBar";
import { JurisdictionChip } from "./JurisdictionChip";
import { IRACDisplay } from "./IRACDisplay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, FileText, AlertTriangle, TrendingUp, Globe, Scale } from "lucide-react";

export function Workspace() {
  const [activeJurisdictions, setActiveJurisdictions] = useState<string[]>(["FR"]);
  const [currentAnalysis, setCurrentAnalysis] = useState<any>(null);

  const jurisdictions = [
    { code: "FR", name: "France", flag: "🇫🇷", isEu: true },
    { code: "BE", name: "Belgique", flag: "🇧🇪", isEu: true },
    { code: "LU", name: "Luxembourg", flag: "🇱🇺", isEu: true },
    { code: "CH", name: "Suisse", flag: "🇨🇭" },
    { code: "QC", name: "Québec", flag: "🇨🇦" },
    { code: "MC", name: "Monaco", flag: "🇲🇨" },
    { code: "OHADA", name: "OHADA", flag: "🌍", isOhada: true },
    { code: "MA", name: "Maroc", flag: "🇲🇦" },
    { code: "TN", name: "Tunisie", flag: "🇹🇳" },
    { code: "RW", name: "Rwanda", flag: "🇷🇼" },
  ];

  const toggleJurisdiction = (code: string) => {
    setActiveJurisdictions(prev => 
      prev.includes(code) 
        ? prev.filter(j => j !== code)
        : [...prev, code]
    );
  };

  const handleSearch = (query: string) => {
    // Mock analysis result
    setCurrentAnalysis({
      issue: {
        title: "Question juridique identifiée",
        content: `Analyse de la question: "${query}". Cette demande concerne le droit applicable dans les juridictions sélectionnées: ${activeJurisdictions.join(", ")}.`,
        citations: []
      },
      rules: {
        title: "Règles juridiques applicables",
        content: "Les règles pertinentes incluent les dispositions du Code civil et les régulations européennes applicables. Une analyse approfondie des sources primaires est en cours.",
        citations: ["Code civil, art. 1134", "Réglement UE 2016/679"]
      },
      application: {
        title: "Application aux faits",
        content: "En appliquant les règles identifiées aux circonstances spécifiques, plusieurs considérations émergent...",
        citations: []
      },
      conclusion: {
        title: "Conclusion et recommandations",
        content: "Basé sur l'analyse juridique, les recommandations suivantes s'appliquent...",
        citations: []
      },
      riskLevel: "MEDIUM" as const,
      hitlRequired: true
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 gradient-primary opacity-10" />
        
        <div className="relative safe-top px-4 py-8 lg:py-16">
          <div className="container mx-auto text-center space-y-8">
            {/* Header */}
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Scale className="h-8 w-8 text-primary" />
                <h1 className="text-3xl lg:text-5xl font-bold gradient-text-primary">
                  Avocat-AI Francophone
                </h1>
              </div>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-longform">
                IA juridique autonome de classe mondiale pour la recherche, rédaction et aide à la décision 
                dans les juridictions francophones
              </p>
            </div>

            {/* Jurisdiction Selection */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">
                Sélectionnez vos juridictions
              </h2>
              <div className="flex flex-wrap gap-2 justify-center max-w-4xl mx-auto">
                {jurisdictions.map((jurisdiction) => (
                  <JurisdictionChip
                    key={jurisdiction.code}
                    {...jurisdiction}
                    isActive={activeJurisdictions.includes(jurisdiction.code)}
                    onClick={() => toggleJurisdiction(jurisdiction.code)}
                  />
                ))}
              </div>
            </div>

            {/* Search Bar */}
            <HeroSearchBar onSearch={handleSearch} />
          </div>
        </div>
      </div>

      {/* Analysis Results */}
      {currentAnalysis && (
        <div className="px-4 py-8">
          <div className="container mx-auto max-w-4xl">
            <IRACDisplay 
              {...currentAnalysis}
              onExport={() => console.log("Export PDF")}
              onSendToHITL={() => console.log("Send to HITL")}
            />
          </div>
        </div>
      )}

      {/* Dashboard Cards */}
      <div className="px-4 py-8">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="glass-surface">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Analyses récentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground">Cette semaine</p>
              </CardContent>
            </Card>

            <Card className="glass-surface">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-success" />
                  Documents traités
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">45</div>
                <p className="text-xs text-muted-foreground">Total actif</p>
              </CardContent>
            </Card>

            <Card className="glass-surface">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  En révision
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3</div>
                <p className="text-xs text-muted-foreground">Nécessite attention</p>
              </CardContent>
            </Card>

            <Card className="glass-surface">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Précision
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">98.5%</div>
                <p className="text-xs text-muted-foreground">Citations vérifiées</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Recent Matters */}
      <div className="px-4 pb-24">
        <div className="container mx-auto">
          <Card className="glass-surface">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Dossiers récents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  title: "Analyse contrat commercial OHADA",
                  jurisdiction: "OHADA",
                  status: "Complété",
                  risk: "LOW" as const
                },
                {
                  title: "Prescription civile - Droit français",
                  jurisdiction: "FR",
                  status: "En révision",
                  risk: "MEDIUM" as const
                },
                {
                  title: "Procédure européenne de règlement",
                  jurisdiction: "EU",
                  status: "En cours",
                  risk: "HIGH" as const
                }
              ].map((matter, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-lg border border-glass-border">
                  <div className="space-y-1">
                    <h3 className="font-medium">{matter.title}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {matter.jurisdiction}
                      </Badge>
                      <Badge 
                        variant={matter.risk === "LOW" ? "default" : matter.risk === "MEDIUM" ? "secondary" : "destructive"}
                        className="text-xs"
                      >
                        {matter.risk}
                      </Badge>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {matter.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}