import { useState } from "react";
import { FileText, Download, Star, Clock, Globe, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Template {
  id: string;
  title: string;
  description: string;
  jurisdiction: string;
  category: string;
  complexity: "Simple" | "Intermédiaire" | "Avancé";
  estimatedTime: string;
  downloads: number;
  rating: number;
  isPopular?: boolean;
  isNew?: boolean;
}

const templates: Template[] = [
  {
    id: "1",
    title: "Contrat de vente commercial OHADA",
    description: "Modèle standard conforme aux Actes uniformes OHADA pour les transactions commerciales",
    jurisdiction: "OHADA",
    category: "Commercial",
    complexity: "Intermédiaire",
    estimatedTime: "45 min",
    downloads: 1247,
    rating: 4.8,
    isPopular: true
  },
  {
    id: "2",
    title: "Bail commercial français",
    description: "Contrat de bail commercial conforme au Code de commerce français",
    jurisdiction: "FR",
    category: "Immobilier",
    complexity: "Avancé",
    estimatedTime: "60 min",
    downloads: 892,
    rating: 4.6
  },
  {
    id: "3",
    title: "Statuts SARL Québec",
    description: "Statuts constitutifs pour société à responsabilité limitée au Québec",
    jurisdiction: "QC",
    category: "Sociétés",
    complexity: "Intermédiaire",
    estimatedTime: "30 min",
    downloads: 567,
    rating: 4.7,
    isNew: true
  },
  {
    id: "4",
    title: "Contrat de travail Belgique",
    description: "Contrat de travail à durée indéterminée conforme au droit belge",
    jurisdiction: "BE",
    category: "Travail",
    complexity: "Simple",
    estimatedTime: "20 min",
    downloads: 756,
    rating: 4.5
  },
  {
    id: "5",
    title: "Accord de confidentialité international",
    description: "NDA multilingue pour opérations transfrontalières",
    jurisdiction: "Multi",
    category: "Commercial",
    complexity: "Simple",
    estimatedTime: "15 min",
    downloads: 1134,
    rating: 4.9,
    isPopular: true
  }
];

const categories = ["Tous", "Commercial", "Immobilier", "Sociétés", "Travail", "Procédure"];
const jurisdictions = ["Tous", "FR", "BE", "LU", "CH", "QC", "OHADA", "Multi"];

export function LegalTemplates() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [selectedJurisdiction, setSelectedJurisdiction] = useState("Tous");

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "Tous" || template.category === selectedCategory;
    const matchesJurisdiction = selectedJurisdiction === "Tous" || template.jurisdiction === selectedJurisdiction;
    
    return matchesSearch && matchesCategory && matchesJurisdiction;
  });

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case "Simple": return "bg-success/10 text-success border-success/20";
      case "Intermédiaire": return "bg-warning/10 text-warning border-warning/20";
      case "Avancé": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-muted/10 text-muted-foreground border-muted/20";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Scale className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Modèles juridiques</h2>
        </div>
        
        {/* Search */}
        <div className="max-w-md">
          <Input
            placeholder="Rechercher un modèle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="glass-surface"
          />
        </div>
      </div>

      {/* Filters */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <div className="space-y-4">
          <div className="flex items-center gap-4 overflow-x-auto pb-2">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              Catégorie:
            </span>
            <TabsList className="glass-surface">
              {categories.map((category) => (
                <TabsTrigger key={category} value={category} className="text-xs">
                  {category}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          
          <div className="flex items-center gap-4 overflow-x-auto pb-2">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              Juridiction:
            </span>
            <div className="flex gap-2">
              {jurisdictions.map((jurisdiction) => (
                <Button
                  key={jurisdiction}
                  variant={selectedJurisdiction === jurisdiction ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedJurisdiction(jurisdiction)}
                  className="text-xs"
                >
                  {jurisdiction}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Tabs>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="glass-surface hover:scale-[1.02] transition-transform">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg leading-tight">
                    {template.title}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {template.jurisdiction}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs border", getComplexityColor(template.complexity))}
                    >
                      {template.complexity}
                    </Badge>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  {template.isPopular && (
                    <Badge variant="default" className="text-xs bg-primary/10 text-primary">
                      <Star className="h-3 w-3" />
                    </Badge>
                  )}
                  {template.isNew && (
                    <Badge variant="default" className="text-xs bg-success/10 text-success">
                      Nouveau
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {template.description}
              </p>
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {template.estimatedTime}
                </div>
                <div className="flex items-center gap-1">
                  <Download className="h-3 w-3" />
                  {template.downloads.toLocaleString()}
                </div>
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-current text-warning" />
                  {template.rating}
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <FileText className="h-4 w-4" />
                  Aperçu
                </Button>
                <Button variant="gradient" size="sm" className="flex-1">
                  <Download className="h-4 w-4" />
                  Utiliser
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <Card className="glass-surface">
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun modèle trouvé</h3>
            <p className="text-muted-foreground">
              Essayez de modifier vos critères de recherche ou de sélectionner d'autres filtres.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}