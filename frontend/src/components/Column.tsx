import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import type { Column as ColumnType, Ticket, User } from '../types';
import { TicketCard } from './TicketCard';

interface Props {
  column: ColumnType;
  tickets: Ticket[];
  users: User[];
  onTicketClick: (ticket: Ticket) => void;
  onAddTicket: (status: string) => void;
}

export function Column({ column, tickets, users, onTicketClick, onAddTicket }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{column.name}</h2>
          <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full px-2 py-0.5 font-medium">
            {tickets.length}
          </span>
        </div>
        <button
          onClick={() => onAddTicket(column.id)}
          className="p-1 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
          title={`Add ticket to ${column.name}`}
        >
          <Plus size={16} />
        </button>
      </div>
      <SortableContext items={tickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex flex-col gap-2 min-h-32 p-2 rounded-xl transition-colors ${
            isOver
              ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-200 dark:ring-indigo-700'
              : 'bg-gray-100/70 dark:bg-gray-800/70'
          }`}
        >
          {tickets.length === 0 && (
            <div className="flex flex-col items-center justify-center h-24 text-gray-300 dark:text-gray-600">
              <span className="text-3xl mb-1">·</span>
              <span className="text-xs">Drop tickets here</span>
            </div>
          )}
          {tickets.map(t => (
            <TicketCard key={t.id} ticket={t} users={users} onClick={() => onTicketClick(t)} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
