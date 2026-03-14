'use client';

import React, { createContext, useCallback, useContext, useState, useEffect } from 'react';

export type CalculatorHistoryEntry = {
  expression: string;
  result: string;
};

type CalculatorContextType = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  history: CalculatorHistoryEntry[];
  addToHistory: (expression: string, result: string) => void;
  clearHistory: () => void;
};

const CalculatorContext = createContext<CalculatorContextType | undefined>(undefined);

const HISTORY_KEY = 'petshop_calculator_history';
const MAX_HISTORY = 50;

function loadHistory(): CalculatorHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: CalculatorHistoryEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch {
    // ignore
  }
}

export function CalculatorProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<CalculatorHistoryEntry[]>([]);

  const addToHistory = useCallback((expression: string, result: string) => {
    setHistory((prev) => {
      const next = [{ expression, result }, ...prev].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  return (
    <CalculatorContext.Provider
      value={{
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen((v) => !v),
        history,
        addToHistory,
        clearHistory,
      }}
    >
      {children}
    </CalculatorContext.Provider>
  );
}

export function useCalculator() {
  const context = useContext(CalculatorContext);
  if (context === undefined) {
    throw new Error('useCalculator must be used within a CalculatorProvider');
  }
  return context;
}
