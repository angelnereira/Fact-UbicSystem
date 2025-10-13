"use client";

import * as React from "react";
import { FileText, Loader2 } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { useConfigurations } from "@/hooks/use-configurations";

export function FoliosStatCard() {
  const { configs, loading: loadingConfigs } = useConfigurations();
  const [folios, setFolios] = React.useState<number | string>("N/A");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (loadingConfigs || configs.length === 0) {
      setFolios("N/A");
      return;
    }

    const fetchFolios = async () => {
      setIsLoading(true);
      setError(null);
      const firstConfig = configs[0];
      try {
        const response = await fetch(`/api/hka/folios?configId=${firstConfig.id}&env=demo`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        setFolios(result.folios);
      } catch (e: any) {
        setError(e.message);
        setFolios("Error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFolios();
  }, [configs, loadingConfigs]);

  const displayValue = isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : String(folios);

  return (
    <StatCard
      title="Folios Restantes (Demo)"
      value={displayValue}
      icon={FileText}
      description={error || "Folios disponibles para timbrar en el primer cliente."}
    />
  );
}
