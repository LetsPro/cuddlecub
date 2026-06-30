import { useEffect, useRef, useState } from 'react';
import { ImagePlus, LoaderCircle } from 'lucide-react';
import { Modal } from './Modal';
import { useAppContext } from '../lib/app-context';
import { deleteMediaAsset, formatFileSize, listMediaAssets, uploadMediaAsset, uploadMediaAssets } from '../lib/media';
import { getErrorMessage } from '../lib/supabase';
import { ToastMessage } from '../lib/toast';
import type { MediaAsset } from '../types/app';

interface MediaPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect?: (asset: MediaAsset) => void;
  onSelectMultiple?: (assets: MediaAsset[]) => void | Promise<void>;
  selectedUrl?: string | null;
  selectedUrls?: string[];
  allowMultiple?: boolean;
  title?: string;
  description?: string;
  allowVideos?: boolean;
}

export function MediaPickerModal({
  open,
  onClose,
  onSelect,
  onSelectMultiple,
  selectedUrl,
  selectedUrls = [],
  allowMultiple = false,
  title = 'Select media',
  description = 'Choose an existing image from the media library or upload a new one.',
  allowVideos = false,
}: MediaPickerModalProps) {
  const { profile, school } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<MediaAsset[]>([]);
  const isMultiple = allowMultiple || Boolean(onSelectMultiple);
  const canDelete = profile.role === 'admin';
  const acceptedAssetLabel = allowVideos ? 'media' : 'image';
  const acceptedAssetPlural = allowVideos ? 'media' : 'images';
  const acceptedFileTypes = allowVideos ? 'image/*,video/*' : 'image/*';
  const visibleAssets = assets.filter((asset) => {
    if (allowVideos) {
      return asset.media_type === 'image' || asset.media_type === 'video' || asset.mime_type?.startsWith('image/') || asset.mime_type?.startsWith('video/');
    }

    return asset.media_type === 'image' || asset.mime_type?.startsWith('image/');
  });

  useEffect(() => {
    if (!open) {
      setSelectedAssets([]);
      return;
    }

    void loadAssets();
  }, [open, school.id]);

  async function loadAssets() {
    setLoading(true);
    setMessage(null);

    try {
      const nextAssets = await listMediaAssets(school.id);
      setAssets(nextAssets);
      if (isMultiple) {
        const selectedAssetUrls = new Set(selectedUrls);
        setSelectedAssets(nextAssets.filter((asset) => selectedAssetUrls.has(asset.public_url)));
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!files.length) return;

    setUploading(true);
    setMessage(null);

    try {
      if (isMultiple) {
        const uploadedAssets = await uploadMediaAssets({
          schoolId: school.id,
          userId: profile.user_id,
          files,
        });

        setAssets((current) => [...uploadedAssets, ...current]);
        setSelectedAssets((current) => {
          const nextAssets = [...current];

          uploadedAssets.forEach((asset) => {
            if (!nextAssets.some((item) => item.id === asset.id)) {
              nextAssets.push(asset);
            }
          });

          return nextAssets;
        });
        setMessage(`${uploadedAssets.length} ${uploadedAssets.length === 1 ? acceptedAssetLabel : acceptedAssetPlural} uploaded.`);
      } else {
        const asset = await uploadMediaAsset({
          schoolId: school.id,
          userId: profile.user_id,
          file: files[0],
        });

        setAssets((current) => [asset, ...current]);
        onSelect?.(asset);
        onClose();
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  function handleAssetSelect(asset: MediaAsset) {
    if (!isMultiple) {
      onSelect?.(asset);
      onClose();
      return;
    }

    setSelectedAssets((current) => {
      if (current.some((item) => item.id === asset.id)) {
        return current.filter((item) => item.id !== asset.id);
      }

      return [...current, asset];
    });
  }

  async function handleConfirmSelection() {
    if (!selectedAssets.length || !onSelectMultiple) return;

    setMessage(null);

    try {
      await onSelectMultiple(selectedAssets);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleDelete(asset: MediaAsset) {
    const confirmed = window.confirm(`Delete ${asset.label || asset.file_name}?`);
    if (!confirmed) return;

    setDeletingId(asset.id);
    setMessage(null);

    try {
      await deleteMediaAsset(asset);
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      setSelectedAssets((current) => current.filter((item) => item.id !== asset.id));
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Modal description={description} onClose={onClose} open={open} size="lg" title={title}>
      <div className="space-y-5">
        <ToastMessage message={message} />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Upload {acceptedAssetLabel}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {allowVideos
                ? isMultiple
                  ? 'Upload or select one or more photos or videos at once.'
                  : 'Photos and videos are supported.'
                : isMultiple
                  ? 'Upload or select one or more images at once.'
                  : 'PNG, JPG, WEBP, and SVG files are supported.'}
            </p>
          </div>
          <div className="flex gap-3">
            <button className="button-secondary" onClick={() => void loadAssets()} type="button">
              Refresh library
            </button>
            <button className="button-primary gap-2" disabled={uploading} onClick={() => fileInputRef.current?.click()} type="button">
              {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {uploading ? 'Uploading...' : isMultiple ? `Upload ${acceptedAssetPlural}` : `Upload ${acceptedAssetLabel}`}
            </button>
            <input accept={acceptedFileTypes} className="hidden" multiple={isMultiple} onChange={handleUpload} ref={fileInputRef} type="file" />
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div
              className="h-12 w-12 animate-spin rounded-full border-4"
              style={{
                borderColor: 'rgb(var(--school-secondary-rgb) / 0.18)',
                borderTopColor: 'var(--school-primary)',
                borderRightColor: 'var(--school-secondary)',
              }}
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleAssets.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 sm:col-span-2 xl:col-span-3">
                No media uploaded yet.
              </div>
            ) : (
              visibleAssets.map((asset) => {
                const isSelected = isMultiple ? selectedAssets.some((item) => item.id === asset.id) : selectedUrl === asset.public_url;
                const isVideo = asset.media_type === 'video' || asset.mime_type?.startsWith('video/');

                return (
                  <article
                    key={asset.id}
                    className={`overflow-hidden rounded-[1.5rem] border bg-white shadow-sm transition ${isSelected ? 'theme-border-primary-soft ring-2 ring-[rgb(var(--school-primary-rgb)/0.2)]' : 'border-slate-200'}`}
                  >
                    <button className="block w-full text-left" onClick={() => handleAssetSelect(asset)} type="button">
                      <div className="h-44 bg-slate-100">
                        {isVideo ? (
                          <video className="h-full w-full object-cover" muted playsInline preload="metadata" src={asset.public_url} />
                        ) : (
                          <img
                            alt={asset.alt_text || asset.label || asset.file_name}
                            className="h-full w-full object-cover"
                            decoding="async"
                            loading="lazy"
                            src={asset.public_url}
                          />
                        )}
                      </div>
                      <div className="space-y-2 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-bold text-slate-900">{asset.label || asset.file_name}</p>
                          {isSelected ? (
                            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700">Selected</span>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-slate-500">{asset.file_name}</p>
                        <p className="text-xs text-slate-400">{formatFileSize(asset.file_size_bytes)}</p>
                      </div>
                    </button>
                    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
                      <span className="text-xs text-slate-400">{asset.media_type}</span>
                      {canDelete ? (
                        <button className="text-xs font-semibold text-rose-600 transition hover:text-rose-700" disabled={deletingId === asset.id} onClick={() => void handleDelete(asset)} type="button">
                          {deletingId === asset.id ? 'Deleting...' : 'Delete'}
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}
        {isMultiple ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4">
            <p className="text-sm font-semibold text-slate-700">{selectedAssets.length} {selectedAssets.length === 1 ? acceptedAssetLabel : acceptedAssetPlural} selected</p>
            <div className="flex gap-3">
              <button className="button-secondary" onClick={onClose} type="button">
                Cancel
              </button>
              <button className="button-primary" disabled={!selectedAssets.length} onClick={() => void handleConfirmSelection()} type="button">
                Use selected {acceptedAssetLabel}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
