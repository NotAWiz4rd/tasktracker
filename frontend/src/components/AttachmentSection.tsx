import { useState, useRef } from 'react';
import { Paperclip, Download, Trash2, Upload } from 'lucide-react';
import type { Attachment } from '../types';
import { api } from '../api';

interface Props {
  attachments: Attachment[];
  onUpload: (file: File) => Promise<unknown>;
  onDelete: (attId: string) => Promise<void>;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentSection({ attachments, onUpload, onDelete }: Props) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    setUploading(true);
    try {
      for (const file of files) {
        await onUpload(file);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
        <Paperclip size={14} />
        Attachments ({attachments.length})
      </h3>

      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg group">
              <div className="flex-1 min-w-0">
                <a
                  href={api.getAttachmentUrl(att.id, att.filename)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline truncate block"
                >
                  {att.filename}
                </a>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {formatSize(att.size_bytes)} · {att.created_by} · {new Date(att.created_at).toLocaleDateString()}
                </span>
              </div>
              <a
                href={api.getAttachmentUrl(att.id, att.filename)}
                download={att.filename}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Download"
              >
                <Download size={14} />
              </a>
              <button
                onClick={() => onDelete(att.id)}
                className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        onDragOver={handleDragOver}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          dragActive
            ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => {
            if (e.target.files?.length) {
              handleFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
        <Upload size={14} className="text-gray-400 dark:text-gray-500" />
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {uploading ? 'Uploading…' : 'Drop files here or click to upload'}
        </span>
      </div>
    </div>
  );
}
