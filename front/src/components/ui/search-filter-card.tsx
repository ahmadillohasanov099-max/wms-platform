import type { ReactNode } from 'react';
import Card, { CardContent } from './card';
import Input from './input';
import { Search } from 'lucide-react';

interface SearchFilterCardProps {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters?: ReactNode;
  className?: string;
}

export default function SearchFilterCard({
  searchPlaceholder = 'Qidirish...',
  searchValue,
  onSearchChange,
  filters,
  className,
}: SearchFilterCardProps) {
  return (
    <Card className={className}>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder={searchPlaceholder}
              icon={<Search className="w-4 h-4 text-slate-400" />}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          {filters && (
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {filters}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
