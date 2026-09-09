/**
 * Governance hook — cek prasyarat operasional (misal: minimal 1 Puskesmas).
 */
import { useEffect, useState, useCallback } from "react";
import { puskesmasService } from "@/services/puskesmas.service";

export interface GovernanceState {
  puskesmasCount: number | null;
  hasPuskesmas: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useGovernance(): GovernanceState {
  const [puskesmasCount, setPuskesmasCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const count = await puskesmasService.count();
      setPuskesmasCount(count);
    } catch {
      setPuskesmasCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    puskesmasCount,
    hasPuskesmas: (puskesmasCount ?? 0) > 0,
    loading,
    refresh,
  };
}
