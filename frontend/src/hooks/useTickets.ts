import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import type { Ticket, TicketCreate, TicketUpdate } from '../types';

export function useTickets(enabled = true) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await api.getTickets();
      setTickets(data);
    } catch (e) {
      console.error(e);
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
    const t = await api.createTicket(data);
    setTickets(prev => [...prev, t]);
    return t;
  };

  const updateTicket = async (id: string, data: TicketUpdate) => {
    const t = await api.updateTicket(id, data);
    setTickets(prev => prev.map(x => x.id === id ? t : x));
    return t;
  };

  const deleteTicket = async (id: string) => {
    await api.deleteTicket(id);
    setTickets(prev => prev.filter(x => x.id !== id));
  };

  const moveTicket = async (id: string, status: string) => {
    const t = await api.moveTicket(id, status);
    setTickets(prev => prev.map(x => x.id === id ? t : x));
    return t;
  };

  const addComment = async (id: string, body: string) => {
    const t = await api.addComment(id, body);
    setTickets(prev => prev.map(x => x.id === id ? t : x));
    return t;
  };

  return { tickets, loading, refresh: fetchTickets, createTicket, updateTicket, deleteTicket, moveTicket, addComment };
}
