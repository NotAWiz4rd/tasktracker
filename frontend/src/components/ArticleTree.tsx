import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, FileText, Plus, Search } from 'lucide-react';
import type { Article, ArticleTreeNode } from '../types';

interface Props {
  articles: Article[];
  selectedSlug: string | null;
  isNewMode?: boolean;
  onSelect: (slug: string) => void;
  onNew: (parentSlug?: string | null) => void;
}

function buildTree(articles: Article[]): ArticleTreeNode[] {
  const bySlug = new Map<string, ArticleTreeNode>();
  for (const a of articles) {
    bySlug.set(a.slug, { ...a, children: [] });
  }
  const roots: ArticleTreeNode[] = [];
  for (const a of articles) {
    const node = bySlug.get(a.slug)!;
    if (a.parent && bySlug.has(a.parent)) {
      bySlug.get(a.parent)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function TreeNode({
  node,
  selectedSlug,
  onSelect,
  onNew,
  depth = 0,
}: {
  node: ArticleTreeNode;
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  onNew: (parentSlug: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer rounded-md text-sm group
          ${selectedSlug === node.slug
            ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(node.slug)}
      >
        {hasChildren ? (
          <button
            className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <FileText size={14} className="shrink-0" />
        <span className="truncate flex-1">{node.title}</span>
        <button
          className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-opacity"
          onClick={(e) => { e.stopPropagation(); onNew(node.slug); }}
          title="Add child article"
        >
          <Plus size={12} />
        </button>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.slug}
              node={child}
              selectedSlug={selectedSlug}
              onSelect={onSelect}
              onNew={onNew}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ArticleTree({ articles, selectedSlug, isNewMode, onSelect, onNew }: Props) {
  const [search, setSearch] = useState('');

  const filteredArticles = useMemo(() => {
    if (!search) return articles;
    const q = search.toLowerCase();
    return articles.filter(a => a.title.toLowerCase().includes(q));
  }, [articles, search]);

  const tree = useMemo(() => buildTree(filteredArticles), [filteredArticles]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Articles</h2>
          <button
            onClick={() => onNew(null)}
            className="p-1 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="New article"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search articles…"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {isNewMode && (
          <div className="flex items-center gap-1 px-2 py-1.5 rounded-md text-sm bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
            <FileText size={14} className="shrink-0" />
            <span className="italic">New article…</span>
          </div>
        )}
        {tree.length === 0 && !isNewMode && (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic px-2 py-4">
            {search ? 'No matching articles' : 'No articles yet — click + to create one'}
          </p>
        )}
        {tree.map(node => (
          <TreeNode
            key={node.slug}
            node={node}
            selectedSlug={selectedSlug}
            onSelect={onSelect}
            onNew={onNew}
          />
        ))}
      </div>
    </div>
  );
}
