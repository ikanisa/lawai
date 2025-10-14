import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface JurisdictionChipProps {
  code: string;
  name: string;
  flag?: string;
  isOhada?: boolean;
  isEu?: boolean;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

export function JurisdictionChip({
  code,
  name,
  flag,
  isOhada,
  isEu,
  isActive,
  onClick,
  className
}: JurisdictionChipProps) {
  return (
    <Button
      variant="glass"
      size="sm"
      onClick={onClick}
      className={cn(
        "jurisdiction-chip relative",
        isActive && "ring-2 ring-primary shadow-glow",
        className
      )}
    >
      <span className="flex items-center gap-2">
        {flag && <span className="text-base">{flag}</span>}
        <span className="font-medium">{code}</span>
        <span className="text-muted-foreground hidden sm:inline">{name}</span>
      </span>
      
      {/* OHADA/EU indicators */}
      <div className="flex gap-1">
        {isOhada && (
          <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
            OHADA
          </Badge>
        )}
        {isEu && (
          <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
            EU
          </Badge>
        )}
      </div>
    </Button>
  );
}