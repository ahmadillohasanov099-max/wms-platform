import React from 'react';
import { Search } from 'lucide-react';
import { Select } from '../../../components/ui';

interface AuditLogsFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedMethod: string;
  onMethodChange: (value: string) => void;
  selectedResource: string;
  onResourceChange: (value: string) => void;
  methodOptions: { value: string; label: string }[];
  resourceOptions: { value: string; label: string }[];
  t: (key: string) => string;
}

export const AuditLogsFilterBar: React.FC<AuditLogsFilterBarProps> = ({
  search,
  onSearchChange,
  selectedMethod,
  onMethodChange,
  selectedResource,
  onResourceChange,
  methodOptions,
  resourceOptions,
  t,
}) => {
  return (
    <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
      <div className="relative flex-1 min-w-[240px]">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={t('auditLogs.searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-52">
          <Select
            value={selectedMethod}
            onChange={(e) => onMethodChange(e.target.value)}
            options={methodOptions}
          />
        </div>

        <div className="w-full sm:w-48">
          <Select
            value={selectedResource}
            onChange={(e) => onResourceChange(e.target.value)}
            options={resourceOptions}
          />
        </div>
      </div>
    </div>
  );
};
