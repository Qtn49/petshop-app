'use client';

import { useState, useCallback } from 'react';
import { useCalculator } from '@/contexts/CalculatorContext';
import { X } from 'lucide-react';

type Operation = '+' | '-' | '×' | '÷' | null;

export default function FloatingCalculator() {
  const { isOpen, close } = useCalculator();
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<Operation>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

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
    const result = value / 100;
    setDisplay(String(result));
    setExpression(String(result));
  }, [display]);

  const handleEquals = useCallback(() => {
    if (operation) {
      performOperation(null);
      setOperation(null);
      setPreviousValue(null);
    }
  }, [operation, performOperation]);

  if (!isOpen) return null;

  const buttons = [
    { label: 'C', onClick: clear, className: 'bg-slate-400 text-white' },
    { label: '±', onClick: () => { const v = -parseFloat(display); setDisplay(String(v)); setExpression(String(v)); }, className: 'bg-slate-400 text-white' },
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
      <div className="relative w-full max-w-sm bg-black rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl">
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
                className={`h-16 rounded-full text-xl font-medium active:scale-95 transition ${btn.className}`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
