'use client';

import { useCalculator } from '@/contexts/CalculatorContext';
import { Calculator } from 'lucide-react';

export default function CalculatorButton() {
  const { toggle } = useCalculator();

  return (
    <button
      onClick={toggle}
      className="fixed bottom-24 lg:bottom-6 right-6 w-14 h-14 rounded-full bg-primary-600 hover:bg-primary-700 text-white shadow-lg flex items-center justify-center z-50 transition hidden md:flex"
      aria-label="Open calculator"
    >
      <Calculator className="w-6 h-6" />
    </button>
  );
}
