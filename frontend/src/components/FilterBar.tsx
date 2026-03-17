import { useState, useEffect, useRef } from 'react';

interface Props {
  users: { id: string; name: string }[];
  priorities: string[];
  labels: string[];
  filters: { assignee: string; priority: string; label: string; search: string };
  onChange: (filters: { assignee: string; priority: string; label: string; search: string }) => void;
}

export function FilterBar({ users, priorities, labels, filters, onChange }: Props) {
  const set = (key: string, val: string) => onChange({ ...filters, [key]: val });
  const [searchInput, setSearchInput] = useState(filters.search);

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });
  const filtersRef = useRef(filters);
  useEffect(() => { filtersRef.current = filters; });

  // Sync local search when external filters change (e.g., clear button)
  useEffect(() => { setSearchInput(filters.search); }, [filters.search]);

  // Debounce the search update
  useEffect(() => {
    const t = setTimeout(() => {
      onChangeRef.current({ ...filtersRef.current, search: searchInput });
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  return (
    <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200 flex-wrap">
      <input
        type="text"
        placeholder="Search tickets…"
        value={searchInput}
        onChange={e => setSearchInput(e.target.value)}
        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
      />
      <select
        value={filters.assignee}
        onChange={e => set('assignee', e.target.value)}
        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">All assignees</option>
        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <select
        value={filters.priority}
        onChange={e => set('priority', e.target.value)}
        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">All priorities</option>
        {priorities.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
      </select>
      <select
        value={filters.label}
        onChange={e => set('label', e.target.value)}
        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">All labels</option>
        {labels.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
      {(filters.assignee || filters.priority || filters.label || filters.search) && (
        <button
          onClick={() => onChange({ assignee: '', priority: '', label: '', search: '' })}
          className="text-sm text-indigo-600 hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
