import { useState, useMemo, useEffect } from 'react';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import type { Column as ColumnType, Ticket, Comment, Config, TicketCreate, TicketUpdate } from '../types';
import { Column } from './Column';
import { TicketModal } from './TicketModal';
import { FilterBar } from './FilterBar';

interface Props {
  columns: ColumnType[];
  config: Config;
  currentUser?: { id: string; name: string };
  tickets: Ticket[];
  onMove: (id: string, status: string) => Promise<Ticket>;
  onCreate: (data: TicketCreate) => Promise<Ticket>;
  onUpdate: (id: string, data: TicketUpdate) => Promise<Ticket>;
  onDelete: (id: string) => Promise<void>;
  onAddComment: (id: string, body: string) => Promise<Comment>;
}

export function Board({ columns, config, currentUser, tickets, onMove, onCreate, onUpdate, onDelete, onAddComment }: Props) {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [newTicketStatus, setNewTicketStatus] = useState<string | null>(null);
  const selectedTicket = selectedTicketId ? (tickets.find(t => t.id === selectedTicketId) ?? null) : null;
  const [filters, setFilters] = useState({ assignee: '', priority: '', label: '', search: '' });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const filteredTickets = useMemo(() => tickets.filter(t => {
    if (filters.assignee && t.assignee !== filters.assignee) return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    if (filters.label && !t.labels.includes(filters.label)) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [tickets, filters]);

  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          if (!selectedTicketId && !newTicketStatus) {
            setNewTicketStatus(sortedColumns[0]?.id ?? 'backlog');
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedTicketId, newTicketStatus, sortedColumns]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const ticket = tickets.find(t => t.id === active.id);
    if (!ticket) return;
    // over.id could be a column id or a ticket id — find the column
    const targetColumn = sortedColumns.find(c => c.id === over.id);
    const targetStatus = targetColumn?.id ?? tickets.find(t => t.id === over.id)?.status;
    if (targetStatus && targetStatus !== ticket.status) {
      await onMove(ticket.id, targetStatus);
    }
  };

  return (
    <>
      <FilterBar
        users={config.users}
        priorities={config.priorities}
        labels={config.labels}
        filters={filters}
        onChange={setFilters}
      />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex gap-5 p-6 overflow-x-auto flex-1">
          {sortedColumns.map(col => (
            <Column
              key={col.id}
              column={col}
              tickets={filteredTickets.filter(t => t.status === col.id)}
              users={config.users}
              onTicketClick={t => setSelectedTicketId(t.id)}
              onAddTicket={status => setNewTicketStatus(status)}
            />
          ))}
        </div>
      </DndContext>

      {selectedTicket && (
        <TicketModal
          ticket={selectedTicket}
          columns={sortedColumns}
          config={config}
          currentUser={currentUser}
          onClose={() => setSelectedTicketId(null)}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onAddComment={onAddComment}
        />
      )}

      {newTicketStatus && (
        <TicketModal
          columns={sortedColumns}
          config={config}
          currentUser={currentUser}
          defaultStatus={newTicketStatus}
          onClose={() => setNewTicketStatus(null)}
          onCreate={onCreate}
        />
      )}
    </>
  );
}
