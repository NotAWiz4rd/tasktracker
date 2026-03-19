import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useToast } from '../contexts/ToastContext';
import type { Ticket, TicketCreate, TicketUpdate } from '../types';

export function useTickets(enabled = true) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [pollingFailed, setPollingFailed] = useState(false);
  const { showToast } = useToast();

  const fetchTickets = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await api.getTickets();
      setPollingFailed(false);
      setTickets(prev => {
        const prevMap = new Map(prev.map(t => [t.id, t]));
        return data.map(t => {
          const old = prevMap.get(t.id);
          return (old && old.updated_at === t.updated_at) ? old : t;
        });
      });
    } catch (e) {
      console.error(e);
      setPollingFailed(true);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchTickets();
    const interval = setInterval(fetchTickets, 5000);
    return () => clearInterval(interval);
  }, [fetchTickets, enabled]);

  const createTicket = async (data: TicketCreate) => {
    try {
      const t = await api.createTicket(data);
      setTickets(prev => [...prev, t]);
      return t;
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to create ticket');
      throw e;
    }
  };

  const updateTicket = async (id: string, data: TicketUpdate) => {
    try {
      const t = await api.updateTicket(id, data);
      setTickets(prev => prev.map(x => x.id === id ? t : x));
      return t;
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to update ticket');
      throw e;
    }
  };

  const deleteTicket = async (id: string) => {
    try {
      await api.deleteTicket(id);
      setTickets(prev => prev.filter(x => x.id !== id));
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to delete ticket');
      throw e;
    }
  };

  const moveTicket = async (id: string, status: string) => {
    try {
      const t = await api.moveTicket(id, status);
      setTickets(prev => prev.map(x => x.id === id ? t : x));
      return t;
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to move ticket');
      throw e;
    }
  };

  const reorderTickets = async (status: string, ids: string[]) => {
    // Optimistic update: reorder local state immediately
    setTickets(prev => {
      const reordered = ids.map(id => prev.find(t => t.id === id)).filter(Boolean) as Ticket[];
      const others = prev.filter(t => t.status !== status);
      return [...reordered, ...others];
    });
    try {
      await api.reorderTickets(status, ids);
    } catch (e) {
      showToast('Failed to reorder tickets');
      fetchTickets(); // revert by re-fetching
    }
  };

  const addComment = async (id: string, body: string) => {
    const comment = await api.addComment(id, body);
    setTickets(prev => prev.map(x => x.id === id ? { ...x, comments: [...x.comments, comment] } : x));
    return comment;
  };

  return { tickets, loading, pollingFailed, refresh: fetchTickets, createTicket, updateTicket, deleteTicket, moveTicket, reorderTickets, addComment };
}
