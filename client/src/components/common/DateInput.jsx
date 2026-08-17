import { forwardRef, useId } from 'react';

const DateInput = forwardRef(function DateInput({
  type = 'date',
  label,
  icon,
  error,
  className = '',
  ...props
}, ref) {
  // Falls back to a generated id so the label is associated even when the
  // caller does not pass one — clicking the label focuses the field, and a
  // screen reader announces it, neither of which worked with a bare <label>.
  const generatedId = useId();
  const id = props.id || generatedId;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <icon className="h-4 w-4 text-gray-400" />
          </div>
        )}
        <input
          ref={ref}
          type={type}
          {...props}
          id={id}
          className={`
            w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm
            text-gray-800 transition-colors placeholder:text-gray-400
            focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100
            dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100
            dark:placeholder:text-gray-500
            dark:focus:border-primary-500 dark:focus:ring-primary-900/40
            ${icon ? 'pl-9' : ''}
            ${error ? 'border-danger-400 focus:border-danger-400 focus:ring-danger-100 dark:border-danger-500' : ''}
          `}
        />
      </div>
      {error && (
        <p className="text-xs text-danger-600 dark:text-danger-400">{error}</p>
      )}
    </div>
  );
});

export default DateInput;
