import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Save, Trash2, Eye, Edit2, Plus, Share2, X, Copy } from 'lucide-react';
import type { ArticleWithContent, Article, Attachment, ArticleCreate, ArticleUpdate } from '../types';
import { api } from '../api';
import { AttachmentSection } from './AttachmentSection';

interface Props {
  article: ArticleWithContent | null;
  articles: Article[];
  isNew: boolean;
  defaultParent?: string | null;
  onSave: (slug: string, data: ArticleUpdate) => Promise<unknown>;
  onCreate: (data: ArticleCreate) => Promise<unknown>;
  onDelete: (slug: string) => Promise<unknown>;
  onSelect: (slug: string) => void;
  onNewChild: (parentSlug: string) => void;
  onUploadAttachment?: (slug: string, file: File) => Promise<Attachment>;
  onDeleteAttachment?: (slug: string, attId: string) => Promise<void>;
}

export function ArticleEditor({ article, articles, isNew, defaultParent, onSave, onCreate, onDelete, onSelect, onNewChild, onUploadAttachment, onDeleteAttachment }: Props) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [parent, setParent] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [includeChildren, setIncludeChildren] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState('Generate Link');
  const [shareError, setShareError] = useState<string | null>(null);

  // Track the "source" to know when we should reset
  const sourceKey = isNew ? `new:${defaultParent ?? ''}` : (article?.slug ?? '');

  // Build the set of all descendants of the current article so they can be
  // excluded from the parent dropdown (setting a descendant as parent = cycle).
  const invalidParents = useMemo(() => {
    if (!article) return new Set<string>();
    const desc = new Set<string>([article.slug]);
    const queue = [article.slug];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const a of articles) {
        if (a.parent === cur && !desc.has(a.slug)) {
          desc.add(a.slug);
          queue.push(a.slug);
        }
      }
    }
    return desc;
  }, [article, articles]);

  useEffect(() => {
    if (isNew) {
      setTitle('');
      setContent('');
      setTags('');
      setParent(defaultParent ?? null);
      setPreview(false);
      setDirty(false);
    } else if (article) {
      setTitle(article.title);
      setContent(article.content);
      setTags(article.tags.join(', '));
      setParent(article.parent);
      setPreview(true);
      setDirty(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);

  const handleSave = useCallback(async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      if (isNew) {
        await onCreate({ title: title.trim(), content, tags: tagList, parent });
      } else if (article) {
        await onSave(article.slug, { title: title.trim(), content, tags: tagList, parent });
      }
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [title, tags, content, parent, isNew, article, saving, onCreate, onSave]);

  // Ctrl+S / Cmd+S shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  const handleDelete = async () => {
    if (!article || isNew) return;
    if (!confirm(`Delete "${article.title}"?`)) return;
    await onDelete(article.slug);
  };

  const markDirty = () => setDirty(true);

  if (!article && !isNew) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 dark:text-gray-500 mb-2">Select an article or create a new one</p>
          <p className="text-xs text-gray-300 dark:text-gray-600">Use the + button in the sidebar to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={editorRef} className="flex-1 flex flex-col min-h-0">
      {/* Header: title + metadata */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
        <input
          type="text"
          value={title}
          onChange={e => { setTitle(e.target.value); markDirty(); }}
          placeholder="Article title"
          autoFocus={isNew}
          className="w-full text-lg font-semibold px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Parent</label>
            <select
              value={parent ?? ''}
              onChange={e => { setParent(e.target.value || null); markDirty(); }}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">None (root level)</option>
              {articles
                .filter(a => !invalidParents.has(a.slug))
                .map(a => (
                  <option key={a.slug} value={a.slug}>{a.title}</option>
                ))}
            </select>
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Tags</label>
            <input
              type="text"
              value={tags}
              onChange={e => { setTags(e.target.value); markDirty(); }}
              placeholder="tag1, tag2, …"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Edit / Preview tabs */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={() => setPreview(false)}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${!preview ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            <Edit2 size={12} /> Edit
          </button>
          <button
            onClick={() => setPreview(true)}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${preview ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            <Eye size={12} /> Preview
          </button>
          <div className="flex-1" />
          {dirty && (
            <span className="text-xs text-amber-500 dark:text-amber-400">Unsaved changes</span>
          )}
          {!isNew && article && (
            <button
              onClick={() => onNewChild(article.slug)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <Plus size={12} /> Add child
            </button>
          )}
          {!isNew && article && (
            <button
              onClick={() => { setShareOpen(true); setShareLink(null); setCopyLabel('Generate Link'); setShareError(null); }}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <Share2 size={12} /> Share
            </button>
          )}
        </div>

        {preview ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mb-3 prose-headings:mt-6 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-code:bg-gray-100 dark:prose-code:bg-gray-700 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-gray-900 dark:prose-pre:bg-gray-950 prose-pre:rounded-lg prose-pre:text-gray-100 [&_pre_code]:bg-transparent dark:[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:rounded-none [&_pre_code]:text-inherit">
              <ReactMarkdown>{content || '*No content yet*'}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <textarea
            value={content}
            onChange={e => { setContent(e.target.value); markDirty(); }}
            placeholder="Write markdown content here…&#10;&#10;Supports **bold**, *italic*, # headings, - lists, ```code``` blocks, and more."
            className="flex-1 p-4 text-sm font-mono leading-relaxed bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none focus:outline-none border-none"
          />
        )}
      </div>

      {/* Children list */}
      {!isNew && article && article.children.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Child articles</h3>
          <div className="flex flex-wrap gap-1.5">
            {article.children.map(child => (
              <button
                key={child.slug}
                onClick={() => onSelect(child.slug)}
                className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >
                {child.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Attachments */}
      {!isNew && article && onUploadAttachment && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <AttachmentSection
            attachments={article.attachments || []}
            onUpload={(file) => onUploadAttachment(article.slug, file)}
            onDelete={(attId) => onDeleteAttachment!(article.slug, attId)}
          />
        </div>
      )}

      {/* Footer: save/delete */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save size={14} />
          {saving ? 'Saving…' : isNew ? 'Create Article' : 'Save'}
        </button>
        {!isNew && (
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
            {navigator.platform.includes('Mac') ? '⌘S' : 'Ctrl+S'}
          </span>
        )}
        {!isNew && article && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-2 text-red-600 dark:text-red-400 text-sm rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 size={14} /> Delete
          </button>
        )}
        {!isNew && article && (
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
            Updated {new Date(article.updated_at).toLocaleString()} by {article.updated_by}
          </span>
        )}
      </div>

      {/* Share modal */}
      {shareOpen && article && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShareOpen(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Share Article</h2>
              <button onClick={() => setShareOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={16} />
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeChildren}
                onChange={e => { setIncludeChildren(e.target.checked); setShareLink(null); setCopyLabel('Generate Link'); }}
                disabled={article.children.length === 0}
                className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
              />
              <span className={`text-sm ${article.children.length === 0 ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                Include child pages
                {article.children.length === 0 && <span className="ml-1 text-xs">(none)</span>}
              </span>
            </label>

            {shareError && (
              <p className="text-xs text-red-500 dark:text-red-400">{shareError}</p>
            )}

            {shareLink && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  onClick={e => (e.target as HTMLInputElement).select()}
                  className="flex-1 text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareLink);
                    setCopyLabel('Copied!');
                    setTimeout(() => setCopyLabel('Copy'), 1500);
                  }}
                  className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Copy to clipboard"
                >
                  <Copy size={14} />
                </button>
              </div>
            )}

            <button
              onClick={async () => {
                if (shareLink) {
                  navigator.clipboard.writeText(shareLink);
                  setCopyLabel('Copied!');
                  setTimeout(() => setCopyLabel('Copy'), 1500);
                  return;
                }
                // Initiate the clipboard write synchronously (required for user-gesture
                // permission) while the token fetch resolves asynchronously via ClipboardItem.
                try {
                  const slug = article.slug;
                  await navigator.clipboard.write([
                    new ClipboardItem({
                      'text/plain': api.getShareToken(slug).then(({ token }) => {
                        const qs = includeChildren ? '?children=1' : '';
                        const url = `${window.location.origin}/share/${slug}/${token}${qs}`;
                        setShareLink(url);
                        return new Blob([url], { type: 'text/plain' });
                      }),
                    }),
                  ]);
                  setCopyLabel('Copied!');
                  setTimeout(() => setCopyLabel('Copy'), 1500);
                } catch {
                  setShareError('Failed to generate link. Please try again.');
                }
              }}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Share2 size={14} />
              {copyLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
