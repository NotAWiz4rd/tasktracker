import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { BookOpen } from 'lucide-react';
import { api } from '../api';
import type { SharedArticleResponse, SharedArticle } from '../types';

function ArticleSection({ article }: { article: SharedArticle }) {
  return (
    <article>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">{article.title}</h2>
      {article.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {article.tags.map(tag => (
            <span key={tag} className="px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mb-3 prose-headings:mt-6 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-code:bg-gray-100 dark:prose-code:bg-gray-700 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-gray-900 dark:prose-pre:bg-gray-950 prose-pre:rounded-lg prose-pre:text-gray-100 [&_pre_code]:bg-transparent dark:[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:rounded-none [&_pre_code]:text-inherit">
        <ReactMarkdown>{article.content || '*No content*'}</ReactMarkdown>
      </div>
    </article>
  );
}

export function SharedArticleView() {
  const { slug, token } = useParams<{ slug: string; token: string }>();
  const [searchParams] = useSearchParams();
  const includeChildren = searchParams.get('children') === '1';

  const [data, setData] = useState<SharedArticleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Apply OS dark mode preference since ThemeContext is not mounted here
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (dark: boolean) => document.documentElement.classList.toggle('dark', dark);
    apply(mq.matches);
    mq.addEventListener('change', e => apply(e.matches));
    return () => mq.removeEventListener('change', e => apply(e.matches));
  }, []);

  useEffect(() => {
    if (!slug || !token) {
      setError('Invalid share link');
      setLoading(false);
      return;
    }
    api.getSharedArticle(slug, token, includeChildren)
      .then(res => { setData(res); setLoading(false); })
      .catch(err => {
        const msg: string = err.message ?? '';
        if (msg.includes('403') || msg.toLowerCase().includes('invalid')) {
          setError('invalid');
        } else if (msg.includes('404')) {
          setError('not_found');
        } else {
          setError('error');
        }
        setLoading(false);
      });
  }, [slug, token, includeChildren]);

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-2">
          <BookOpen size={18} className="text-indigo-500" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">TaskTracker KB</span>
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-8">
        {children}
      </main>
      <footer className="border-t border-gray-200 dark:border-gray-700 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
        Shared via TaskTracker — read only
      </footer>
    </div>
  );

  if (loading) {
    return shell(
      <div className="flex items-center justify-center h-40">
        <div className="text-gray-400 dark:text-gray-500">Loading…</div>
      </div>
    );
  }

  if (error || !data) {
    const msg =
      error === 'invalid' ? 'This link is invalid or has expired.' :
      error === 'not_found' ? 'Article not found.' :
      'Failed to load article.';
    return shell(
      <div className="flex items-center justify-center h-40">
        <p className="text-gray-500 dark:text-gray-400">{msg}</p>
      </div>
    );
  }

  return shell(
    <div className="space-y-4">
      {/* Main article title + metadata */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">{data.article.title}</h1>
        {data.article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {data.article.tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
          Last updated {new Date(data.article.updated_at).toLocaleString()}
        </p>
        <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mb-3 prose-headings:mt-6 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-code:bg-gray-100 dark:prose-code:bg-gray-700 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-gray-900 dark:prose-pre:bg-gray-950 prose-pre:rounded-lg prose-pre:text-gray-100 [&_pre_code]:bg-transparent dark:[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:rounded-none [&_pre_code]:text-inherit">
          <ReactMarkdown>{data.article.content || '*No content*'}</ReactMarkdown>
        </div>
      </div>

      {/* Child articles */}
      {data.children.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-8 space-y-10">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Included pages</h2>
          {data.children.map(child => (
            <ArticleSection key={child.slug} article={child} />
          ))}
        </div>
      )}
    </div>
  );
}
