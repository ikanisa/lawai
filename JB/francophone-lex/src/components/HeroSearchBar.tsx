import { Search, Sparkles, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface HeroSearchBarProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
}

export function HeroSearchBar({ 
  onSearch, 
  placeholder = "Posez votre question juridique en français..." 
}: HeroSearchBarProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && onSearch) {
      onSearch(query.trim());
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <form onSubmit={handleSubmit} className="relative">
        <div className="glass-surface p-2 rounded-xl">
          <div className="flex items-center gap-3">
            <Search className="h-5 w-5 text-muted-foreground ml-2" />
            
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="border-0 bg-transparent text-lg placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            
            <Button
              type="submit"
              variant="gradient"
              size="lg"
              disabled={!query.trim()}
              className="rounded-lg"
            >
              <Sparkles className="h-4 w-4" />
              Analyser
            </Button>
          </div>
        </div>
      </form>
      
      {/* Quick suggestions */}
      <div className="flex flex-wrap gap-2 justify-center">
        {[
          "Délai de prescription civile",
          "Procédure OHADA",
          "Droit du travail France",
          "Procédure européenne"
        ].map((suggestion) => (
          <Button
            key={suggestion}
            variant="outline"
            size="sm"
            onClick={() => setQuery(suggestion)}
            className="text-sm"
          >
            <MessageCircle className="h-3 w-3" />
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );
}