import type { Ticket, Comment, TicketCreate, TicketUpdate, Article, ArticleWithContent, ArticleCreate, ArticleUpdate, ArticleTreeNode, SharedArticleResponse } from './types';

const BASE = '';

function getToken(): string | null {
  return localStorage.getItem('token');
}

function headers(): HeadersInit {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });
  if (res.status === 401) {
    const hadToken = !!localStorage.getItem('token');
    localStorage.removeItem('token');
    if (hadToken) window.location.reload();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function publicRequest<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

type UserPreferences = { dark_mode: boolean; split_view: boolean };
type UserResponse = { id: string; name: string; avatar_color: string; preferences: UserPreferences };

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; user: UserResponse }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<UserResponse>('/api/me'),
  updatePreferences: (prefs: Partial<UserPreferences>) =>
    request<UserResponse>('/api/me/preferences', { method: 'PATCH', body: JSON.stringify(prefs) }),
  getConfig: () => request<{ users: { id: string; name: string; avatar_color: string }[]; priorities: string[]; labels: string[] }>('/api/config'),
  getColumns: () => request<{ columns: { id: string; name: string; order: number }[] }>('/api/columns'),
  getTickets: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<Ticket[]>(`/api/tickets${qs}`);
  },
  getTicket: (id: string) => request<Ticket>(`/api/tickets/${id}`),
  createTicket: (data: TicketCreate) => request<Ticket>('/api/tickets', { method: 'POST', body: JSON.stringify(data) }),
  updateTicket: (id: string, data: Partial<TicketUpdate>) => request<Ticket>(`/api/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTicket: (id: string) => request<void>(`/api/tickets/${id}`, { method: 'DELETE' }),
  moveTicket: (id: string, status: string) => request<Ticket>(`/api/tickets/${id}/move`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  reorderTickets: (status: string, ids: string[]) => request<void>('/api/tickets/reorder', { method: 'POST', body: JSON.stringify({ status, ids }) }),
  addComment: (id: string, body: string) => request<Comment>(`/api/tickets/${id}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),

  // Knowledge Base
  getArticles: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<Article[]>(`/api/kb${qs}`);
  },
  getArticle: (slug: string) => request<ArticleWithContent>(`/api/kb/${slug}`),
  createArticle: (data: ArticleCreate) => request<ArticleWithContent>('/api/kb', { method: 'POST', body: JSON.stringify(data) }),
  updateArticle: (slug: string, data: ArticleUpdate) => request<ArticleWithContent>(`/api/kb/${slug}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteArticle: (slug: string) => request<void>(`/api/kb/${slug}`, { method: 'DELETE' }),
  getKbTree: () => request<ArticleTreeNode[]>('/api/kb/tree'),
  getShareToken: (slug: string) => request<{ token: string }>(`/api/kb/${slug}/share-token`),
  getSharedArticle: (slug: string, token: string, includeChildren = false): Promise<SharedArticleResponse> => {
    const qs = includeChildren ? '?children=1' : '';
    return publicRequest<SharedArticleResponse>(`/api/kb/share/${slug}/${token}${qs}`);
  },
};
