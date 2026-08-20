import { forwardRef } from 'react';
import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}
const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-gray-700 dark:text-slate-200 dark:font-bold">
            {label}
            {props.required && (
              <span className="text-red-500 dark:text-rose-400 ml-1">*</span>
            )}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              'w-full rounded-lg border bg-white text-gray-900 border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
              'dark:bg-slate-950/80 dark:text-white dark:font-semibold dark:border-white/20 dark:focus:ring-blue-500/40 dark:focus:border-blue-400',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all duration-150',
              'px-3 py-2 pr-9 appearance-none',
              error && 'border-red-500 focus:ring-red-500 dark:border-rose-500 dark:focus:ring-rose-500/40',
              className,
            )}
            {...props}
          >
            {placeholder && (
              <option value="" className="bg-slate-900 text-white">{placeholder}</option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled} className={cn("bg-slate-900 text-white", opt.disabled && "text-gray-500 bg-gray-800")}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
        </div>
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
      </div>
    );
  },
);
Select.displayName = 'Select';
export default Select;