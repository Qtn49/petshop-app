'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useCalculator } from '@/contexts/CalculatorContext';
import { X } from 'lucide-react';

type Operation = '+' | '-' | '×' | '÷' | null;

export default function FloatingCalculator() {
  const { isOpen, close, history, addToHistory, clearHistory } = useCalculator();
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<Operation>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const inputDigit = useCallback(
    (digit: string) => {
      if (waitingForOperand) {
        setDisplay(digit);
        setExpression((prev) => prev + digit);
        setWaitingForOperand(false);
      } else {
        const newDisplay = display === '0' && digit !== '.' ? digit : display + digit;
        setDisplay(newDisplay);
        setExpression((prev) => {
          if (prev === '' || /[+\-×÷]\s*$/.test(prev)) return prev + digit;
          if (prev === '0' && digit !== '.') return digit;
          return prev + digit;
        });
      }
    },
    [display, waitingForOperand]
  );

  const inputDecimal = useCallback(() => {
    if (waitingForOperand) {
      setDisplay('0.');
      setExpression((prev) => prev + '0.');
      setWaitingForOperand(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
      setExpression((prev) => {
        if (prev === '' || /[+\-×÷]\s*$/.test(prev)) return prev + '0.';
        return prev + '.';
      });
    }
  }, [display, waitingForOperand]);

  const clear = useCallback(() => {
    setDisplay('0');
    setExpression('');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  }, []);

  const backspace = useCallback(() => {
    if (waitingForOperand) return;
    if (display.length <= 1 || display === '0') {
      setDisplay('0');
      setExpression((prev) => prev.slice(0, -1) || '0');
    } else {
      const newDisplay = display.slice(0, -1);
      setDisplay(newDisplay);
      setExpression((prev) => prev.slice(0, -1));
    }
  }, [display, waitingForOperand]);

  const toggleSign = useCallback(() => {
    const v = -parseFloat(display);
    setDisplay(String(v));
    setExpression(String(v));
  }, [display]);

  const addOperatorToExpression = (op: Operation) => {
    const sym = op ? { '+': ' + ', '-': ' - ', '×': ' × ', '÷': ' ÷ ' }[op] : '';
    return sym;
  };

  const performOperation = useCallback(
    (nextOperation: Operation) => {
      const inputValue = parseFloat(display);

      if (previousValue === null) {
        setPreviousValue(inputValue);
        setExpression((prev) => prev + addOperatorToExpression(nextOperation));
      } else if (operation) {
        const currentValue = previousValue;
        let result = 0;
        switch (operation) {
          case '+':
            result = currentValue + inputValue;
            break;
          case '-':
            result = currentValue - inputValue;
            break;
          case '×':
            result = currentValue * inputValue;
            break;
          case '÷':
            result = inputValue !== 0 ? currentValue / inputValue : 0;
            break;
        }
        setDisplay(String(result));
        setExpression(String(result) + addOperatorToExpression(nextOperation));
        setPreviousValue(result);
      }

      setWaitingForOperand(true);
      setOperation(nextOperation);
    },
    [display, previousValue, operation]
  );

  const inputPercent = useCallback(() => {
    const value = parseFloat(display);
    if (previousValue !== null && (operation === '+' || operation === '-')) {
      const percentAmount = previousValue * value / 100;
      setDisplay(String(percentAmount));
      setExpression((prev) => prev.replace(/[\d.]+$/, value + '%'));
    } else if (previousValue !== null && (operation === '×' || operation === '÷')) {
      const fraction = value / 100;
      setDisplay(String(fraction));
      setExpression((prev) => prev.replace(/[\d.]+$/, value + '%'));
    } else {
      const result = value / 100;
      setDisplay(String(result));
      setExpression(value + '%');
    }
  }, [display, previousValue, operation]);

  const handleEquals = useCallback(() => {
    if (operation) {
      const inputValue = parseFloat(display);
      if (previousValue !== null) {
        let result = 0;
        switch (operation) {
          case '+': result = previousValue + inputValue; break;
          case '-': result = previousValue - inputValue; break;
          case '×': result = previousValue * inputValue; break;
          case '÷': result = inputValue !== 0 ? previousValue / inputValue : 0; break;
        }
        const resultStr = String(result);
        const expr = (expression || display).trim();
        if (expr) addToHistory(expr, resultStr);
      }
      performOperation(null);
      setOperation(null);
      setPreviousValue(null);
    }
  }, [operation, performOperation, display, previousValue, expression, addToHistory]);

  // Keyboard support
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent keys from reaching elements behind the calculator
      if (/^[\d.+\-*\/=%]$/.test(e.key) || ['Enter', 'Escape', 'Backspace', 'Delete'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      }

      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key >= '0' && e.key <= '9') { inputDigit(e.key); return; }
      if (e.key === '.') { inputDecimal(); return; }
      if (e.key === '+') { performOperation('+'); return; }
      if (e.key === '-') { performOperation('-'); return; }
      if (e.key === '*') { performOperation('×'); return; }
      if (e.key === '/') { performOperation('÷'); return; }
      if (e.key === '%') { inputPercent(); return; }
      if (e.key === 'Enter' || e.key === '=') { handleEquals(); return; }
      if (e.key === 'Backspace') { backspace(); return; }
      if (e.key === 'Delete') { clear(); return; }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close, inputDigit, inputDecimal, performOperation, inputPercent, handleEquals, backspace, clear]);

  // Auto-focus container when opened
  useEffect(() => {
    if (isOpen && containerRef.current) {
      containerRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const buttons = [
    { label: 'C', onClick: clear, className: 'bg-slate-400 text-white' },
    { label: '±', onClick: toggleSign, className: 'bg-slate-400 text-white' },
    { label: '%', onClick: inputPercent, className: 'bg-slate-400 text-white' },
    { label: '÷', onClick: () => performOperation('÷'), className: 'bg-amber-500 text-white' },
    { label: '7', onClick: () => inputDigit('7'), className: 'bg-slate-600 text-white' },
    { label: '8', onClick: () => inputDigit('8'), className: 'bg-slate-600 text-white' },
    { label: '9', onClick: () => inputDigit('9'), className: 'bg-slate-600 text-white' },
    { label: '×', onClick: () => performOperation('×'), className: 'bg-amber-500 text-white' },
    { label: '4', onClick: () => inputDigit('4'), className: 'bg-slate-600 text-white' },
    { label: '5', onClick: () => inputDigit('5'), className: 'bg-slate-600 text-white' },
    { label: '6', onClick: () => inputDigit('6'), className: 'bg-slate-600 text-white' },
    { label: '-', onClick: () => performOperation('-'), className: 'bg-amber-500 text-white' },
    { label: '1', onClick: () => inputDigit('1'), className: 'bg-slate-600 text-white' },
    { label: '2', onClick: () => inputDigit('2'), className: 'bg-slate-600 text-white' },
    { label: '3', onClick: () => inputDigit('3'), className: 'bg-slate-600 text-white' },
    { label: '+', onClick: () => performOperation('+'), className: 'bg-amber-500 text-white' },
    { label: '0', onClick: () => inputDigit('0'), className: 'bg-slate-600 text-white col-span-2' },
    { label: '.', onClick: inputDecimal, className: 'bg-slate-600 text-white' },
    { label: '=', onClick: handleEquals, className: 'bg-amber-500 text-white' },
  ];

  return (
    <div className="fixed inset-0 z-50 hidden md:flex md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={close} />
      <div
        ref={containerRef}
        tabIndex={-1}
        className="relative w-full max-w-sm bg-black rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl outline-none"
      >
        <div className="flex justify-between items-center p-4">
          <span className="text-white/60 text-sm">Calculator</span>
          <button
            onClick={close}
            className="p-2 rounded-full hover:bg-white/10 text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* History on top */}
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-1">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="text-white/70 text-sm hover:text-white"
            >
              {showHistory ? 'Hide history' : 'History'}
            </button>
            {history.length > 0 && (
              <button
                type="button"
                onClick={clearHistory}
                className="text-white/50 text-xs hover:text-white/80"
              >
                Clear
              </button>
            )}
          </div>
          {showHistory && history.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1 text-sm text-white/80 mb-2">
              {history.map((entry, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="truncate">{entry.expression}</span>
                  <span className="font-medium text-white shrink-0">= {entry.result}</span>
                </div>
              ))}
            </div>
          )}
          {showHistory && history.length > 0 && <div className="border-b border-white/20 mb-2" />}
        </div>

        <div className="px-4 pb-4">
          <div className="text-right text-white/70 text-lg py-2 min-h-[28px] overflow-x-auto break-all">
            {expression || '0'}
          </div>
          <div className="text-right text-4xl font-light text-white py-2 min-h-[48px] overflow-x-auto">
            {display}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {buttons.map((btn) => (
              <button
                key={btn.label}
                onClick={btn.onClick}
                tabIndex={-1}
                className={`h-16 rounded-full text-xl font-medium active:scale-95 transition ${btn.className}`}
              >
                {btn.label}
              </button>
            ))}
          </div>
          <p className="text-center text-white/30 text-xs mt-3">
            Use keyboard to type &middot; Esc to close
          </p>
        </div>
      </div>
    </div>
  );
}
