import { useState } from "react";
import { Folder, Calendar, AlertTriangle, Clock, Users, FileText, Plus, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

interface Matter {
  id: string;
  title: string;
  client: string;
  type: string;
  status: "active" | "pending" | "completed" | "on_hold";
  priority: "low" | "medium" | "high" | "urgent";
  jurisdiction: string;
  createdDate: string;
  nextDeadline?: string;
  progress: number;
  documentsCount: number;
  teamMembers: string[];
  description: string;
}

const matters: Matter[] = [
  {
    id: "1",
    title: "Acquisition SAS TechCorp",
    client: "Groupe Investisseurs SA",
    type: "Fusion-Acquisition",
    status: "active",
    priority: "high",
    jurisdiction: "FR",
    createdDate: "2024-01-15",
    nextDeadline: "2024-02-01",
    progress: 75,
    documentsCount: 24,
    teamMembers: ["Marie Dubois", "Jean Moreau"],
    description: "Due diligence et structuration de l'acquisition de TechCorp par le Groupe Investisseurs"
  },
  {
    id: "2",
    title: "Litige commercial OHADA",
    client: "Export Africa SARL",
    type: "Contentieux",
    status: "active",
    priority: "urgent",
    jurisdiction: "OHADA",
    createdDate: "2024-01-20",
    nextDeadline: "2024-01-30",
    progress: 45,
    documentsCount: 18,
    teamMembers: ["Aminata Kane", "Pierre Martin"],
    description: "Litige contractuel concernant une vente internationale de marchandises"
  },
  {
    id: "3",
    title: "Restructuration Québec Inc.",
    client: "Innovation Québec Inc.",
    type: "Restructuration",
    status: "pending",
    priority: "medium",
    jurisdiction: "QC",
    createdDate: "2024-01-10",
    nextDeadline: "2024-02-15",
    progress: 30,
    documentsCount: 12,
    teamMembers: ["Sophie Tremblay"],
    description: "Réorganisation corporative et optimisation fiscale pour expansion US"
  },
  {
    id: "4",
    title: "Bail commercial Luxembourg",
    client: "Retail Europe SA",
    type: "Immobilier",
    status: "completed",
    priority: "low",
    jurisdiction: "LU",
    createdDate: "2023-12-01",
    progress: 100,
    documentsCount: 8,
    teamMembers: ["Marc Weber"],
    description: "Négociation et rédaction d'un bail commercial pour espace de vente"
  }
];

export function MatterManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const filteredMatters = matters.filter(matter => {
    const matchesSearch = matter.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         matter.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         matter.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === "all" || matter.status === selectedStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-success/10 text-success border-success/20";
      case "pending": return "bg-warning/10 text-warning border-warning/20";
      case "completed": return "bg-primary/10 text-primary border-primary/20";
      case "on_hold": return "bg-muted/10 text-muted-foreground border-muted/20";
      default: return "bg-muted/10 text-muted-foreground border-muted/20";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-destructive/10 text-destructive border-destructive/20";
      case "high": return "bg-warning/10 text-warning border-warning/20";
      case "medium": return "bg-primary/10 text-primary border-primary/20";
      case "low": return "bg-muted/10 text-muted-foreground border-muted/20";
      default: return "bg-muted/10 text-muted-foreground border-muted/20";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "Actif";
      case "pending": return "En attente";
      case "completed": return "Terminé";
      case "on_hold": return "En pause";
      default: return status;
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "urgent": return "Urgent";
      case "high": return "Élevée";
      case "medium": return "Moyenne";
      case "low": return "Faible";
      default: return priority;
    }
  };

  const getDaysUntilDeadline = (deadline: string) => {
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Folder className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Dossiers</h2>
        </div>
        
        <Button variant="gradient">
          <Plus className="h-4 w-4" />
          Nouveau dossier
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un dossier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 glass-surface"
            />
          </div>
        </div>

        <Tabs value={selectedStatus} onValueChange={setSelectedStatus}>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground">
              Statut:
            </span>
            <TabsList className="glass-surface">
              <TabsTrigger value="all">Tous</TabsTrigger>
              <TabsTrigger value="active">Actifs</TabsTrigger>
              <TabsTrigger value="pending">En attente</TabsTrigger>
              <TabsTrigger value="completed">Terminés</TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
      </div>

      {/* Matters Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredMatters.map((matter) => (
          <Card key={matter.id} className="glass-surface hover:scale-[1.02] transition-transform">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-lg leading-tight">
                    {matter.title}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {matter.jurisdiction}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={`text-xs border ${getStatusColor(matter.status)}`}
                    >
                      {getStatusLabel(matter.status)}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={`text-xs border ${getPriorityColor(matter.priority)}`}
                    >
                      {getPriorityLabel(matter.priority)}
                    </Badge>
                  </div>
                </div>
                
                {matter.nextDeadline && (
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {getDaysUntilDeadline(matter.nextDeadline)} jours
                    </div>
                    {getDaysUntilDeadline(matter.nextDeadline) <= 7 && (
                      <AlertTriangle className="h-4 w-4 text-warning ml-auto mt-1" />
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Client:</span>
                  <span className="font-medium">{matter.client}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Type:</span>
                  <span>{matter.type}</span>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground leading-relaxed font-longform">
                {matter.description}
              </p>
              
              {/* Progress */}
              {matter.status !== "completed" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progression</span>
                    <span className="font-medium">{matter.progress}%</span>
                  </div>
                  <Progress value={matter.progress} className="h-2" />
                </div>
              )}
              
              {/* Stats */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  <span>{matter.documentsCount} documents</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{matter.teamMembers.length} membre(s)</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(matter.createdDate).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-glass-border">
                <Button variant="outline" size="sm" className="flex-1">
                  Voir détails
                </Button>
                <Button variant="glass" size="sm" className="flex-1">
                  Ouvrir dossier
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredMatters.length === 0 && (
        <Card className="glass-surface">
          <CardContent className="p-8 text-center">
            <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun dossier trouvé</h3>
            <p className="text-muted-foreground">
              Essayez de modifier vos critères de recherche ou créez un nouveau dossier.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}