import { useState, useEffect, useCallback } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { Ticket, Column, Comment, TicketCreate, TicketUpdate } from '../types';
import type { Config } from '../types';
import { CommentThread } from './CommentThread';

interface Props {
  ticket?: Ticket | null;
  columns: Column[];
  config: Config;
  currentUser?: { id: string; name: string };
  defaultStatus?: string;
  onClose: () => void;
  onCreate?: (data: TicketCreate) => Promise<Ticket>;
  onUpdate?: (id: string, data: TicketUpdate) => Promise<Ticket>;
  onDelete?: (id: string) => Promise<void>;
  onAddComment?: (id: string, body: string) => Promise<Comment>;
}

export function TicketModal({ ticket, columns, config, currentUser, defaultStatus, onClose, onCreate, onUpdate, onDelete, onAddComment }: Props) {
  const isEdit = !!ticket;
  const [title, setTitle] = useState(ticket?.title ?? '');
  const [description, setDescription] = useState(ticket?.description ?? '');
  const [status, setStatus] = useState(ticket?.status ?? defaultStatus ?? 'backlog');
  const [assignee, setAssignee] = useState(ticket?.assignee ?? '');
  const [priority, setPriority] = useState(ticket?.priority ?? 'medium');
  const [labels, setLabels] = useState<string[]>(ticket?.labels ?? []);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');

  const toggleLabel = (l: string) =>
    setLabels(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);

  const saveAndClose = useCallback(async () => {
    if (isEdit && onUpdate && title.trim()) {
      setSaving(true);
      try {
        await onUpdate(ticket!.id, { title, description, assignee: assignee || null, priority, labels });
      } finally {
        setSaving(false);
      }
    }
    onClose();
  }, [isEdit, onUpdate, title, description, assignee, priority, labels, onClose, ticket]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (isEdit) { await saveAndClose(); return; }
    setSaving(true);
    try {
      if (onCreate) {
        await onCreate({ title, description, status, assignee: assignee || null, priority, labels });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    if (onDelete && ticket) {
      await onDelete(ticket.id);
      onClose();
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') saveAndClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveAndClose]);

  const tabClass = (tab: 'details' | 'history') =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
    }`;

  const inputClass = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={e => { if (e.target === e.currentTarget) saveAndClose(); }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{isEdit ? `Edit ${ticket!.id}` : 'New Ticket'}</h2>
          <button onClick={saveAndClose} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {isEdit && (
          <div className="flex border-b border-gray-100 dark:border-gray-700 px-6">
            <button className={tabClass('details')} onClick={() => setActiveTab('details')}>Details</button>
            <button className={tabClass('history')} onClick={() => setActiveTab('history')}>History</button>
          </div>
        )}

        {(!isEdit || activeTab === 'details') && (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ticket title"
                autoFocus
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe the ticket…"
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {!isEdit && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Column</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className={inputClass}
                  >
                    {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Assignee</label>
                  {currentUser && assignee !== currentUser.id && (
                    <button
                      type="button"
                      onClick={() => setAssignee(currentUser.id)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium"
                    >
                      Assign Me
                    </button>
                  )}
                </div>
                <select
                  value={assignee}
                  onChange={e => setAssignee(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Unassigned</option>
                  {config.users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                  className={inputClass}
                >
                  {config.priorities.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Labels</label>
              <div className="flex flex-wrap gap-2">
                {config.labels.map(l => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => toggleLabel(l)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      labels.includes(l)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
              {isEdit ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
                    confirmDelete
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'
                  }`}
                >
                  <Trash2 size={14} />
                  {confirmDelete ? 'Confirm delete?' : 'Delete'}
                </button>
              ) : (
                <div />
              )}
              {!isEdit && (
                <div className="flex gap-2">
                  <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                  <button
                    type="submit"
                    disabled={!title.trim() || saving}
                    className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Create ticket'}
                  </button>
                </div>
              )}
            </div>
          </form>
        )}

        {isEdit && onAddComment && activeTab === 'details' && (
          <div className="px-6 pb-6 border-t border-gray-100 dark:border-gray-700 pt-4">
            <CommentThread
              comments={ticket!.comments}
              onAdd={(body) => onAddComment(ticket!.id, body)}
            />
          </div>
        )}

        {isEdit && activeTab === 'history' && (
          <div className="px-6 pb-6 pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">History</h3>
            {(ticket?.history ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">No history yet.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {[...(ticket?.history ?? [])].reverse().map((entry, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <div className="text-xs text-gray-400 dark:text-gray-500 shrink-0 pt-0.5 w-32">{new Date(entry.at).toLocaleString()}</div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{entry.by}</span>
                      <span className="text-gray-500 dark:text-gray-400 ml-1">{entry.change}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
