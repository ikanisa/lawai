import { useState } from "react";
import { Workspace } from "@/components/Workspace";
import { MobileNavigation } from "@/components/MobileNavigation";

const Index = () => {
  const [activeTab, setActiveTab] = useState("workspace");
  const [showNewQuery, setShowNewQuery] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case "workspace":
        return <Workspace />;
      case "research":
        return (
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center glass-surface p-8 rounded-xl">
              <h2 className="text-2xl font-bold mb-4">Module de Recherche</h2>
              <p className="text-muted-foreground">Interface de recherche juridique avancée</p>
            </div>
          </div>
        );
      case "drafting":
        return (
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center glass-surface p-8 rounded-xl">
              <h2 className="text-2xl font-bold mb-4">Module de Rédaction</h2>
              <p className="text-muted-foreground">Outils de rédaction et révision de documents</p>
            </div>
          </div>
        );
      case "hitl":
        return (
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center glass-surface p-8 rounded-xl">
              <h2 className="text-2xl font-bold mb-4">Révision Humaine</h2>
              <p className="text-muted-foreground">Queue de révision et validation</p>
            </div>
          </div>
        );
      default:
        return <Workspace />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {renderContent()}
      
      {/* Mobile Navigation */}
      <div className="lg:hidden">
        <MobileNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          hitlCount={3}
          onNewQuery={() => setShowNewQuery(true)}
        />
      </div>
    </div>
  );
};

export default Index;
