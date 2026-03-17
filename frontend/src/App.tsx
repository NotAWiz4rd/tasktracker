import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useTickets } from './hooks/useTickets';
import { LoginScreen } from './components/LoginScreen';
import { Header } from './components/Header';
import { Board } from './components/Board';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './contexts/ToastContext';
import { api } from './api';
import type { Column, Config } from './types';

function AppInner() {
  const { user, loading: authLoading, login, logout } = useAuth();
  const { tickets, pollingFailed, createTicket, updateTicket, deleteTicket, moveTicket, addComment } = useTickets(!!user);
  const [columns, setColumns] = useState<Column[]>([]);
  const [config, setConfig] = useState<Config>({ users: [], priorities: [], labels: [] });

  useEffect(() => {
    if (!user) return;
    api.getColumns().then(r => setColumns(r.columns)).catch(console.error);
    api.getConfig().then(c => setConfig(c)).catch(console.error);
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header user={user} onLogout={logout} />
      {pollingFailed && (
        <div className="bg-yellow-100 border-b border-yellow-300 text-yellow-800 text-sm text-center py-2 px-4">
          Connection lost — showing cached data
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Board
          columns={columns}
          config={config}
          currentUser={user ?? undefined}
          tickets={tickets}
          onMove={moveTicket}
          onCreate={createTicket}
          onUpdate={updateTicket}
          onDelete={deleteTicket}
          onAddComment={addComment}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </ErrorBoundary>
  );
}
