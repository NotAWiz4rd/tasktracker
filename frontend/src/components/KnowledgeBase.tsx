import { useState, useCallback, useEffect } from 'react';
import { useArticles } from '../hooks/useArticles';
import { ArticleTree } from './ArticleTree';
import { ArticleEditor } from './ArticleEditor';

interface Props {
  initialSlug: string | null;
  onArticleSelect: (slug: string | null) => void;
}

export function KnowledgeBase({ initialSlug, onArticleSelect }: Props) {
  const { articles, selectedArticle, selectArticle, createArticle, updateArticle, deleteArticle, uploadArticleAttachment, deleteArticleAttachment } = useArticles();
  const [isNew, setIsNew] = useState(false);
  const [defaultParent, setDefaultParent] = useState<string | null>(null);

  // Load article from URL on mount or when URL changes
  useEffect(() => {
    if (initialSlug && initialSlug !== selectedArticle?.slug) {
      selectArticle(initialSlug);
    } else if (!initialSlug && selectedArticle !== null) {
      selectArticle(null);
    }
  }, [initialSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback((slug: string) => {
    setIsNew(false);
    selectArticle(slug);
    onArticleSelect(slug);
  }, [selectArticle, onArticleSelect]);

  const handleNew = useCallback((parentSlug?: string | null) => {
    setIsNew(true);
    setDefaultParent(parentSlug ?? null);
    selectArticle(null);
    onArticleSelect(null);
  }, [selectArticle, onArticleSelect]);

  const handleCreate = useCallback(async (data: Parameters<typeof createArticle>[0]) => {
    const article = await createArticle(data);
    setIsNew(false);
    if (article) onArticleSelect(article.slug);
  }, [createArticle, onArticleSelect]);

  const handleNewChild = useCallback((parentSlug: string) => {
    setIsNew(true);
    setDefaultParent(parentSlug);
    selectArticle(null);
    onArticleSelect(null);
  }, [selectArticle, onArticleSelect]);

  const handleDelete = useCallback(async (slug: string) => {
    await deleteArticle(slug);
    onArticleSelect(null);
  }, [deleteArticle, onArticleSelect]);

  return (
    <div className="flex-1 flex min-h-0">
      <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
        <ArticleTree
          articles={articles}
          selectedSlug={selectedArticle?.slug ?? null}
          isNewMode={isNew}
          onSelect={handleSelect}
          onNew={handleNew}
        />
      </div>
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-800">
        <ArticleEditor
          article={selectedArticle}
          articles={articles}
          isNew={isNew}
          defaultParent={defaultParent}
          onSave={updateArticle}
          onCreate={handleCreate}
          onDelete={handleDelete}
          onSelect={handleSelect}
          onNewChild={handleNewChild}
          onUploadAttachment={uploadArticleAttachment}
          onDeleteAttachment={deleteArticleAttachment}
        />
      </div>
    </div>
  );
}
