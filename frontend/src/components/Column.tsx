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
          <h2 className="text-sm font-semibold text-gray-700">{column.name}</h2>
          <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 font-medium">
            {tickets.length}
          </span>
        </div>
        <button
          onClick={() => onAddTicket(column.id)}
          className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          title={`Add ticket to ${column.name}`}
        >
          <Plus size={16} />
        </button>
      </div>
      <SortableContext items={tickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex flex-col gap-2 min-h-32 p-2 rounded-xl transition-colors ${
            isOver ? 'bg-indigo-50 ring-2 ring-indigo-200' : 'bg-gray-100/70'
          }`}
        >
          {tickets.length === 0 && (
            <div className="flex flex-col items-center justify-center h-24 text-gray-300">
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
