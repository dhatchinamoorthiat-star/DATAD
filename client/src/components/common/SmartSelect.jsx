import { useState, useRef, useEffect } from 'react';

const OTHER_VALUE = '__other__';

const base = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
const inputErr = 'border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-600';

export default function SmartSelect({
  options = [],
  value = '',
  onChange,
  label,
  placeholder = 'Select\u2026',
  allowOther = true,
  variant = 'dropdown',
  required = false,
  error,
  name,
  disabled = false,
}) {
  const [isOther, setIsOther] = useState(false);
  const [customVal, setCustomVal] = useState('');
  const otherRef = useRef(null);

  const normalOpts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));

  // Sync external value into isOther/customVal, but NEVER reset isOther when
  // value is empty — that would override the user's "Other..." selection before
  // they finish typing (the flow is: select "Other..." → onChange('') → this
  // effect sees value='' and would wrongly hide the input).
  //
  // This mirrors a prop into local state rather than deriving it, precisely
  // because of that asymmetry — the reset is intentionally not symmetric.
  useEffect(() => {
    if (value && typeof value === 'string') {
      if (!normalOpts.some((o) => o.value === value)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsOther(true);
        setCustomVal(value);
      } else {
        setIsOther(false);
        setCustomVal('');
      }
    }
  }, [value, normalOpts]);

  useEffect(() => {
    if (isOther && otherRef.current) otherRef.current.focus();
  }, [isOther]);

  function handleSelect(selected) {
    if (selected === OTHER_VALUE) {
      setIsOther(true);
      setCustomVal('');
      onChange('');
    } else {
      setIsOther(false);
      setCustomVal('');
      onChange(selected);
    }
  }

  function handleCustomChange(e) {
    const raw = e.target.value;
    setCustomVal(raw);
    onChange(raw);
  }

  function handleCustomBlur() {
    const trimmed = customVal.trim();
    if (trimmed !== customVal) {
      setCustomVal(trimmed);
      onChange(trimmed);
    }
  }

  function validateCustom(val) {
    if (!isOther || !val) return '';
    const trimmed = val.trim();
    if (!trimmed) return 'Please enter a value';
    if (trimmed.length < 2) return 'Must be at least 2 characters';
    if (trimmed.length > 100) return 'Must be at most 100 characters';
    return '';
  }

  const validationErr = required && !value ? (error || 'This field is required') : isOther ? validateCustom(customVal) : '';
  const showErr = validationErr && typeof validationErr === 'string';

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400" id={`${name}-label`}>
          {label}
          {required && <span className="ml-0.5 text-red-400">*</span>}
        </label>
      )}

      {variant === 'dropdown' ? (
        <select
          value={isOther ? OTHER_VALUE : value}
          onChange={(e) => handleSelect(e.target.value)}
          className={`${base} ${showErr ? inputErr : ''} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          disabled={disabled}
          name={name}
          aria-labelledby={label ? `${name}-label` : undefined}
          aria-invalid={showErr ? 'true' : undefined}
          aria-describedby={showErr ? `${name}-error` : undefined}
        >
          <option value="" disabled>{placeholder}</option>
          {normalOpts.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
          {allowOther && <option value={OTHER_VALUE}>Other\u2026</option>}
        </select>
      ) : (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={label ? `${name}-label` : undefined}>
          {normalOpts.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => handleSelect(o.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                value === o.value && !isOther
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : 'border-gray-200 bg-white hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
              }`}
              aria-pressed={value === o.value && !isOther}
            >
              {o.label}
            </button>
          ))}
          {allowOther && (
            <button
              type="button"
              onClick={() => handleSelect(OTHER_VALUE)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isOther
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : 'border-gray-200 bg-white hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
              }`}
              aria-pressed={isOther}
            >
              Other\u2026
            </button>
          )}
        </div>
      )}

      {isOther && (
        <div className="overflow-hidden transition-all duration-200 ease-in-out">
          <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400" htmlFor={`${name}-custom`}>
            Please specify
          </label>
          <input
            ref={otherRef}
            id={`${name}-custom`}
            type="text"
            value={customVal}
            onChange={handleCustomChange}
            onBlur={handleCustomBlur}
            placeholder="Type your value\u2026"
            className={`${base} ${showErr ? inputErr : ''}`}
            maxLength={100}
            aria-invalid={showErr ? 'true' : undefined}
            aria-describedby={showErr ? `${name}-error` : undefined}
          />
        </div>
      )}

      {showErr && (
        <p id={`${name}-error`} className="text-xs text-red-500" role="alert">
          {validationErr}
        </p>
      )}
    </div>
  );
}
