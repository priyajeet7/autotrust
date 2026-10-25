import { useState } from 'react';
import { CATEGORIES, categoryLabel } from '../api/types';
import type { SearchFilters } from '../api/types';

export const emptyFilters: SearchFilters = {
  make: '',
  model: '',
  category: '',
  minPrice: '',
  maxPrice: '',
};

interface SearchBarProps {
  onSearch: (filters: SearchFilters) => void;
  onReset: () => void;
}

const field =
  'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200';

export function SearchBar({ onSearch, onReset }: SearchBarProps) {
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters);
  const set = (key: keyof SearchFilters) => (value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));

  return (
    <form
      role="search"
      className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(filters);
      }}
    >
      <label className="text-xs font-medium text-slate-600">
        Make
        <input
          className={field}
          placeholder="e.g. Toyota"
          value={filters.make}
          onChange={(e) => set('make')(e.target.value)}
        />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Model
        <input
          className={field}
          placeholder="e.g. Civic"
          value={filters.model}
          onChange={(e) => set('model')(e.target.value)}
        />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Category
        <select
          className={field}
          value={filters.category}
          onChange={(e) => set('category')(e.target.value)}
        >
          <option value="">Any</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {categoryLabel(category)}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-slate-600">
        Min price
        <input
          className={field}
          type="number"
          min={0}
          placeholder="0"
          value={filters.minPrice}
          onChange={(e) => set('minPrice')(e.target.value)}
        />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Max price
        <input
          className={field}
          type="number"
          min={0}
          placeholder="Any"
          value={filters.maxPrice}
          onChange={(e) => set('maxPrice')(e.target.value)}
        />
      </label>
      <div className="col-span-2 flex items-end gap-2 md:col-span-1">
        <button
          type="submit"
          className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => {
            setFilters(emptyFilters);
            onReset();
          }}
          className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
