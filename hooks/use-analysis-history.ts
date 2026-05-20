"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HistoryItem } from "@/lib/types";

const STORAGE_KEY = "chart-vision-ai:history";
const MAX_HISTORY = 10;

export interface UseAnalysisHistoryReturn {
  history: HistoryItem[];
  mounted: boolean;
  addToHistory: (item: Omit<HistoryItem, "id" | "timestamp">) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
}

function isValidHistoryItem(item: unknown): item is HistoryItem {
  if (typeof item !== "object" || item === null) return false;
  const h = item as Record<string, unknown>;
  if (typeof h.id !== "string" || typeof h.timestamp !== "number") return false;
  if (typeof h.options !== "object" || h.options === null) return false;
  if (typeof h.result !== "object" || h.result === null) return false;
  const r = h.result as Record<string, unknown>;
  return (
    typeof r.trend === "string" &&
    typeof r.pattern === "string" &&
    typeof r.confidence === "number" &&
    Array.isArray(r.supportLevels) &&
    Array.isArray(r.resistanceLevels) &&
    typeof r.longView === "string" &&
    typeof r.shortView === "string" &&
    typeof r.riskSummary === "string"
  );
}

function loadFromStorage(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidHistoryItem);
  } catch {
    return [];
  }
}

function saveToStorage(items: HistoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    try {
      const stripped = items.map(({ thumbnailDataUrl: _thumbnail, ...rest }) => rest);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
    } catch {
      // localStorage를 사용할 수 없는 환경에서는 히스토리 저장만 건너뜁니다.
    }
  }
}

export function useAnalysisHistory(): UseAnalysisHistoryReturn {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setHistory(loadFromStorage());
    setMounted(true);
  }, []);

  const addToHistory = useCallback(
    (item: Omit<HistoryItem, "id" | "timestamp">) => {
      const newItem: HistoryItem = {
        ...item,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
      };

      setHistory((prev) => {
        const next = [newItem, ...prev].slice(0, MAX_HISTORY);
        saveToStorage(next);
        return next;
      });
    },
    []
  );

  const removeFromHistory = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((item) => item.id !== id);
      saveToStorage(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { history, mounted, addToHistory, removeFromHistory, clearHistory };
}
