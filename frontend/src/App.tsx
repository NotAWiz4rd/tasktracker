import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useTickets } from './hooks/useTickets';
import { LoginScreen } from './components/LoginScreen';
import { Header } from './components/Header';
import type { View } from './components/Header';
import { Board } from './components/Board';
import { KnowledgeBase } from './components/KnowledgeBase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { api } from './api';
import type { Column, Config } from './types';

function AppInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading, login, logout } = useAuth();
  const { tickets, pollingFailed, createTicket, updateTicket, deleteTicket, moveTicket, addComment } = useTickets(!!user);
  const [columns, setColumns] = useState<Column[]>([]);
  const [config, setConfig] = useState<Config>({ users: [], priorities: [], labels: [] });

  const view: View = location.pathname.startsWith('/kb') ? 'kb' : 'board';

  // Parse deep-link targets from URL
  const pathParts = location.pathname.split('/').filter(Boolean);
  const urlTicketId = view === 'board' && pathParts.length > 1 ? pathParts.slice(1).join('/') : null;
  const urlSlug = view === 'kb' && pathParts.length > 1 ? pathParts.slice(1).join('/') : null;

  useEffect(() => {
    if (!user) return;
    api.getColumns().then(r => setColumns(r.columns)).catch(console.error);
    api.getConfig().then(c => setConfig(c)).catch(console.error);
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
        <div className="text-gray-400 dark:text-gray-500">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  const handleViewChange = (v: View) => navigate(v === 'board' ? '/board' : '/kb');
  const handleTicketSelect = (id: string | null) => navigate(id ? `/board/${id}` : '/board');
  const handleArticleSelect = (slug: string | null) => navigate(slug ? `/kb/${slug}` : '/kb');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Header user={user} view={view} onViewChange={handleViewChange} onLogout={logout} />
      {pollingFailed && view === 'board' && (
        <div className="bg-yellow-100 dark:bg-yellow-900/30 border-b border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200 text-sm text-center py-2 px-4">
          Connection lost — showing cached data
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        {view === 'board' ? (
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
            selectedTicketId={urlTicketId}
            onTicketSelect={handleTicketSelect}
          />
        ) : (
          <KnowledgeBase
            initialSlug={urlSlug}
            onArticleSelect={handleArticleSelect}
          />
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/board" replace />} />
            <Route path="/*" element={<AppInner />} />
          </Routes>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
