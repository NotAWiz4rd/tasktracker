import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useToast } from '../contexts/ToastContext';
import type { Article, ArticleWithContent, ArticleCreate, ArticleUpdate } from '../types';

export function useArticles(enabled = true) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<ArticleWithContent | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const fetchArticles = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await api.getArticles();
      setArticles(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchArticles();
    const interval = setInterval(fetchArticles, 10000);
    return () => clearInterval(interval);
  }, [fetchArticles, enabled]);

  const selectArticle = useCallback(async (slug: string | null) => {
    if (!slug) {
      setSelectedArticle(null);
      return;
    }
    try {
      const data = await api.getArticle(slug);
      setSelectedArticle(data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to load article');
    }
  }, [showToast]);

  const createArticle = async (data: ArticleCreate) => {
    try {
      const a = await api.createArticle(data);
      await fetchArticles();
      setSelectedArticle(a);
      showToast('Article created', 'success');
      return a;
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to create article');
      throw e;
    }
  };

  const updateArticle = async (slug: string, data: ArticleUpdate) => {
    try {
      const a = await api.updateArticle(slug, data);
      await fetchArticles();
      setSelectedArticle(a);
      showToast('Article saved', 'success');
      return a;
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to update article');
      throw e;
    }
  };

  const deleteArticle = async (slug: string) => {
    try {
      await api.deleteArticle(slug);
      setSelectedArticle(null);
      await fetchArticles();
      showToast('Article deleted', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to delete article');
      throw e;
    }
  };

  const uploadArticleAttachment = async (slug: string, file: File) => {
    try {
      const att = await api.uploadArticleAttachment(slug, file);
      if (selectedArticle && selectedArticle.slug === slug) {
        setSelectedArticle({ ...selectedArticle, attachments: [...(selectedArticle.attachments || []), att] });
      }
      await fetchArticles();
      return att;
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to upload attachment');
      throw e;
    }
  };

  const deleteArticleAttachment = async (slug: string, attId: string) => {
    try {
      await api.deleteArticleAttachment(slug, attId);
      if (selectedArticle && selectedArticle.slug === slug) {
        setSelectedArticle({ ...selectedArticle, attachments: (selectedArticle.attachments || []).filter(a => a.id !== attId) });
      }
      await fetchArticles();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to delete attachment');
      throw e;
    }
  };

  return {
    articles,
    selectedArticle,
    loading,
    selectArticle,
    createArticle,
    updateArticle,
    deleteArticle,
    uploadArticleAttachment,
    deleteArticleAttachment,
    refresh: fetchArticles,
  };
}
