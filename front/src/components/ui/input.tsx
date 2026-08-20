import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...props }, ref) => {
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
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-300 w-4 h-4">
              {icon}
            </div>
          )}
          <input ref={ref} className={cn(
              'w-full rounded-lg border bg-white text-gray-900 border-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
              'dark:bg-slate-950/50 dark:text-white dark:font-semibold dark:border-white/20 dark:placeholder:text-slate-400 dark:focus:ring-blue-500/40 dark:focus:border-blue-400',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-slate-900/50',
              'transition-all duration-150',
              icon ? 'pl-9 pr-3 py-2' : 'px-3 py-2',
              error && 'border-red-500 focus:ring-red-500 dark:border-rose-500 dark:focus:ring-rose-500/40',
              className,
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';
export default Input;