import { Home, Search, FileText, AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MobileNavigationProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  hitlCount?: number;
  onNewQuery?: () => void;
}

export function MobileNavigation({ 
  activeTab = "workspace", 
  onTabChange, 
  hitlCount = 0,
  onNewQuery 
}: MobileNavigationProps) {
  const tabs = [
    { id: "workspace", label: "Accueil", icon: Home },
    { id: "research", label: "Recherche", icon: Search },
    { id: "drafting", label: "Rédaction", icon: FileText },
    { id: "hitl", label: "Révision", icon: AlertCircle, badge: hitlCount },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="glass-surface border-t border-glass-border">
        <div className="flex items-center justify-around px-2 py-2">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <Button
                key={tab.id}
                variant="ghost"
                size="sm"
                onClick={() => onTabChange?.(tab.id)}
                className={cn(
                  "flex flex-col items-center gap-1 h-auto py-2 px-3 rounded-lg",
                  isActive && "bg-primary/10 text-primary"
                )}
              >
                <div className="relative">
                  <Icon className={cn(
                    "h-5 w-5",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )} />
                  {tab.badge && tab.badge > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-4 w-4 p-0 text-xs flex items-center justify-center"
                    >
                      {tab.badge}
                    </Badge>
                  )}
                </div>
                <span className={cn(
                  "text-xs font-medium",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  {tab.label}
                </span>
              </Button>
            );
          })}
        </div>
      </div>
      
      {/* Floating Action Button */}
      <Button
        variant="gradient"
        size="icon"
        onClick={onNewQuery}
        className="absolute bottom-20 right-4 h-14 w-14 rounded-full shadow-glow"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}