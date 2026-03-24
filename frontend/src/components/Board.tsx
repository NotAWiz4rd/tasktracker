import { useState, useMemo, useEffect } from 'react';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { Column as ColumnType, Ticket, Comment, Attachment, Config, TicketCreate, TicketUpdate } from '../types';
import { Column } from './Column';
import { TicketModal } from './TicketModal';
import { FilterBar } from './FilterBar';

interface Props {
  columns: ColumnType[];
  config: Config;
  currentUser?: { id: string; name: string };
  tickets: Ticket[];
  onMove: (id: string, status: string) => Promise<Ticket>;
  onReorder: (status: string, ids: string[]) => Promise<void>;
  onCreate: (data: TicketCreate) => Promise<Ticket>;
  onUpdate: (id: string, data: TicketUpdate) => Promise<Ticket>;
  onDelete: (id: string) => Promise<void>;
  onAddComment: (id: string, body: string) => Promise<Comment>;
  onUploadAttachment: (id: string, file: File) => Promise<Attachment>;
  onDeleteAttachment: (id: string, attId: string) => Promise<void>;
  onUnarchive: (id: string) => Promise<Ticket>;
  selectedTicketId: string | null;
  onTicketSelect: (id: string | null) => void;
  showArchived: boolean;
  onShowArchivedChange: (show: boolean) => void;
}

export function Board({ columns, config, currentUser, tickets, onMove, onReorder, onCreate, onUpdate, onDelete, onAddComment, onUploadAttachment, onDeleteAttachment, onUnarchive, selectedTicketId, onTicketSelect, showArchived, onShowArchivedChange }: Props) {
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
    if (!over || active.id === over.id) return;
    const ticket = tickets.find(t => t.id === active.id);
    if (!ticket) return;
    // over.id could be a column id or a ticket id — find the target status
    const targetColumn = sortedColumns.find(c => c.id === over.id);
    const targetStatus = targetColumn?.id ?? tickets.find(t => t.id === over.id)?.status;
    if (!targetStatus) return;
    if (targetStatus !== ticket.status) {
      await onMove(ticket.id, targetStatus);
    } else {
      // Same-column reorder
      const columnTickets = filteredTickets.filter(t => t.status === ticket.status);
      const oldIndex = columnTickets.findIndex(t => t.id === active.id);
      const newIndex = columnTickets.findIndex(t => t.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(columnTickets, oldIndex, newIndex);
        await onReorder(ticket.status, reordered.map(t => t.id));
      }
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
        showArchived={showArchived}
        onShowArchivedChange={onShowArchivedChange}
      />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex gap-5 p-6 overflow-x-auto flex-1">
          {sortedColumns.map(col => (
            <Column
              key={col.id}
              column={col}
              tickets={filteredTickets.filter(t => t.status === col.id)}
              users={config.users}
              onTicketClick={t => onTicketSelect(t.id)}
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
          onClose={() => onTicketSelect(null)}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onAddComment={onAddComment}
          onUploadAttachment={onUploadAttachment}
          onDeleteAttachment={onDeleteAttachment}
          onUnarchive={onUnarchive}
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
