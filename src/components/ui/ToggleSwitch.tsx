type Props = {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
};

export default function ToggleSwitch({ checked, onChange, disabled = false, label, description }: Props) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2
          ${checked ? 'bg-amber-500' : 'bg-slate-200'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0
            transition duration-200 ease-in-out
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
      {(label || description) && (
        <div className="flex flex-col min-w-0">
          {label && (
            <span className={`text-sm font-medium ${disabled ? 'text-slate-400' : 'text-slate-700'}`}>
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-slate-500">{description}</span>
          )}
        </div>
      )}
    </div>
  );
}
