import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Comment } from '../types';

interface Props {
  comments: Comment[];
  onAdd: (body: string) => Promise<unknown>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function authorInitials(author: string) {
  if (author.startsWith('agent:')) return 'AI';
  return author.split(/[\s_-]/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function CommentThread({ comments, onAdd }: Props) {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      await onAdd(body.trim());
      setBody('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Comments ({comments.length})</h3>
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {comments.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">No comments yet.</p>
        )}
        {comments.map(c => (
          <div key={c.id} className="flex gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ${c.author.startsWith('agent:') ? 'bg-purple-500' : 'bg-gray-400 dark:bg-gray-600'}`}>
              {authorInitials(c.author)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{c.author}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(c.created_at)}</span>
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 [&>p]:mb-1 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>code]:bg-gray-100 dark:[&>code]:bg-gray-700 [&>code]:px-1 [&>code]:rounded">
                <ReactMarkdown>{c.body}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Add a comment…"
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={!body.trim() || submitting}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Post
        </button>
      </form>
    </div>
  );
}
