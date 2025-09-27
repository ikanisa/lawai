import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Download, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface IRACSection {
  title: string;
  content: string;
  citations?: string[];
}

interface IRACDisplayProps {
  issue?: IRACSection;
  rules?: IRACSection;
  application?: IRACSection;
  conclusion?: IRACSection;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH";
  hitlRequired?: boolean;
  onExport?: () => void;
  onSendToHITL?: () => void;
}

export function IRACDisplay({
  issue,
  rules,
  application,
  conclusion,
  riskLevel,
  hitlRequired,
  onExport,
  onSendToHITL
}: IRACDisplayProps) {
  const getRiskIcon = () => {
    switch (riskLevel) {
      case "LOW": return <CheckCircle className="h-4 w-4" />;
      case "MEDIUM": return <AlertCircle className="h-4 w-4" />;
      case "HIGH": return <AlertTriangle className="h-4 w-4" />;
      default: return null;
    }
  };

  const getRiskColor = () => {
    switch (riskLevel) {
      case "LOW": return "text-success";
      case "MEDIUM": return "text-warning";
      case "HIGH": return "text-destructive";
      default: return "text-muted-foreground";
    }
  };

  const renderSection = (section: IRACSection | undefined, defaultTitle: string) => {
    if (!section) return null;

    return (
      <div className="irac-section rounded-xl">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          {section.title || defaultTitle}
          {section.citations && section.citations.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {section.citations.length} citations
            </Badge>
          )}
        </h3>
        
        <div className="prose prose-invert max-w-none">
          <p className="text-foreground leading-relaxed font-longform">
            {section.content}
          </p>
        </div>
        
        {section.citations && section.citations.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Sources:</h4>
            {section.citations.map((citation, index) => (
              <div key={index} className="citation-card rounded-lg text-sm">
                {citation}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Risk Banner */}
      {riskLevel && (
        <Card className={cn(
          "glass-surface border-l-4",
          riskLevel === "LOW" && "border-l-success",
          riskLevel === "MEDIUM" && "border-l-warning",
          riskLevel === "HIGH" && "border-l-destructive"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={getRiskColor()}>
                  {getRiskIcon()}
                </span>
                <div>
                  <p className="font-medium">
                    Niveau de risque: <span className={getRiskColor()}>{riskLevel}</span>
                  </p>
                  {hitlRequired && (
                    <p className="text-sm text-muted-foreground">
                      Révision humaine recommandée
                    </p>
                  )}
                </div>
              </div>
              
              {hitlRequired && onSendToHITL && (
                <Button variant="outline" size="sm" onClick={onSendToHITL}>
                  <AlertTriangle className="h-4 w-4" />
                  Envoyer en révision
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* IRAC Sections */}
      <div className="space-y-6">
        {renderSection(issue, "Issue - Question juridique")}
        {renderSection(rules, "Rules - Règles applicables")}
        {renderSection(application, "Application - Analyse")}
        {renderSection(conclusion, "Conclusion - Réponse")}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-glass-border">
        <Button variant="outline" onClick={() => navigator.clipboard.writeText("IRAC content")}>
          <Copy className="h-4 w-4" />
          Copier
        </Button>
        
        {onExport && (
          <Button variant="glass" onClick={onExport}>
            <Download className="h-4 w-4" />
            Exporter PDF
          </Button>
        )}
      </div>
    </div>
  );
}