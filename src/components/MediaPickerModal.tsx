import { useEffect, useRef, useState } from 'react';
import { Crop, Eye, ImagePlus, LoaderCircle, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { useAppContext } from '../lib/app-context';
import { deleteMediaAsset, formatFileSize, listMediaAssets, uploadMediaAsset, uploadMediaAssets } from '../lib/media';
import { getErrorMessage } from '../lib/supabase';
import { ToastMessage } from '../lib/toast';
import type { MediaAsset } from '../types/app';

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

type CropDragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se';

interface CropDragState {
  mode: CropDragMode;
  startX: number;
  startY: number;
  startArea: CropArea;
  rect: DOMRect;
}

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
  allowCropInMultiple?: boolean;
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
  allowCropInMultiple = false,
}: MediaPickerModalProps) {
  const { profile, school } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cropSurfaceRef = useRef<HTMLDivElement | null>(null);
  const cropDragRef = useRef<CropDragState | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<MediaAsset[]>([]);
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);
  const [cropPromptAsset, setCropPromptAsset] = useState<MediaAsset | null>(null);
  const [cropAsset, setCropAsset] = useState<MediaAsset | null>(null);
  const [cropArea, setCropArea] = useState<CropArea>({ x: 10, y: 10, width: 80, height: 80 });
  const [savingCrop, setSavingCrop] = useState(false);
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
      setPreviewAsset(null);
      setCropPromptAsset(null);
      setCropAsset(null);
      setCropArea({ x: 10, y: 10, width: 80, height: 80 });
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
        promptForCropOrSelect(asset);
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  function handleAssetSelect(asset: MediaAsset) {
    if (!isMultiple) {
      setPreviewAsset(null);
      promptForCropOrSelect(asset);
      return;
    }

    setSelectedAssets((current) => {
      if (current.some((item) => item.id === asset.id)) {
        return current.filter((item) => item.id !== asset.id);
      }

      return [...current, asset];
    });
  }

  function handlePreviewSelect(asset: MediaAsset) {
    handleAssetSelect(asset);
    if (isMultiple) {
      setPreviewAsset(null);
    }
  }

  function canCropAsset(asset: MediaAsset) {
    const mimeType = asset.mime_type ?? '';
    return (
      asset.media_type === 'image' &&
      !mimeType.includes('svg') &&
      !mimeType.includes('gif') &&
      Boolean(asset.public_url)
    );
  }

  function promptForCropOrSelect(asset: MediaAsset) {
    if (!canCropAsset(asset)) {
      onSelect?.(asset);
      onClose();
      return;
    }

    setCropPromptAsset(asset);
  }

  function selectOriginalAsset() {
    if (!cropPromptAsset) return;
    onSelect?.(cropPromptAsset);
    setCropPromptAsset(null);
    onClose();
  }

  function openCropEditor() {
    if (!cropPromptAsset) return;
    setCropArea({ x: 10, y: 10, width: 80, height: 80 });
    setCropAsset(cropPromptAsset);
    setCropPromptAsset(null);
  }

  function openMultipleCropEditor(asset: MediaAsset) {
    setCropArea({ x: 10, y: 10, width: 80, height: 80 });
    setCropAsset(asset);
  }

  function deriveCroppedFileName(fileName: string) {
    const baseName = fileName.replace(/\.[^/.]+$/, '') || 'media';
    return `${baseName}-cropped.webp`;
  }

  function clampCropArea(area: CropArea) {
    const minSize = 12;
    const width = Math.max(minSize, Math.min(area.width, 100));
    const height = Math.max(minSize, Math.min(area.height, 100));
    const x = Math.max(0, Math.min(area.x, 100 - width));
    const y = Math.max(0, Math.min(area.y, 100 - height));

    return { x, y, width, height };
  }

  function startCropDrag(event: React.PointerEvent<HTMLElement>, mode: CropDragMode) {
    const surface = cropSurfaceRef.current;
    const rect = surface?.getBoundingClientRect();
    if (!surface || !rect) return;

    event.preventDefault();
    event.stopPropagation();
    surface.setPointerCapture(event.pointerId);
    cropDragRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startArea: cropArea,
      rect,
    };
  }

  function handleCropPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = cropDragRef.current;
    if (!drag) return;

    const dx = ((event.clientX - drag.startX) / drag.rect.width) * 100;
    const dy = ((event.clientY - drag.startY) / drag.rect.height) * 100;
    const next = { ...drag.startArea };

    if (drag.mode === 'move') {
      next.x = drag.startArea.x + dx;
      next.y = drag.startArea.y + dy;
    } else {
      if (drag.mode.includes('w')) {
        next.x = drag.startArea.x + dx;
        next.width = drag.startArea.width - dx;
      }

      if (drag.mode.includes('e')) {
        next.width = drag.startArea.width + dx;
      }

      if (drag.mode.includes('n')) {
        next.y = drag.startArea.y + dy;
        next.height = drag.startArea.height - dy;
      }

      if (drag.mode.includes('s')) {
        next.height = drag.startArea.height + dy;
      }
    }

    setCropArea(clampCropArea(next));
  }

  function stopCropDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (cropDragRef.current) {
      cropDragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }

  async function loadImageElement(source: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Image could not be loaded for cropping.'));
      image.src = source;
    });
  }

  async function createCroppedFile(asset: MediaAsset, area: CropArea) {
    const image = await loadImageElement(asset.public_url);
    const sourceX = Math.round((area.x / 100) * image.naturalWidth);
    const sourceY = Math.round((area.y / 100) * image.naturalHeight);
    const sourceWidth = Math.round((area.width / 100) * image.naturalWidth);
    const sourceHeight = Math.round((area.height / 100) * image.naturalHeight);

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, sourceWidth);
    canvas.height = Math.max(1, sourceHeight);

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Image crop could not be prepared.');
    }

    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', 0.9);
    });

    if (!blob) {
      throw new Error('Cropped image could not be created.');
    }

    return new File([blob], deriveCroppedFileName(asset.file_name), {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  }

  async function saveCroppedAsset() {
    if (!cropAsset) return;

    setSavingCrop(true);
    setMessage(null);

    try {
      const croppedFile = await createCroppedFile(cropAsset, cropArea);
      const croppedAsset = await uploadMediaAsset({
        schoolId: school.id,
        userId: profile.user_id,
        file: croppedFile,
        label: `${cropAsset.label || cropAsset.file_name.replace(/\.[^/.]+$/, '')} cropped`,
        altText: cropAsset.alt_text,
      });

      setAssets((current) => [croppedAsset, ...current]);
      if (isMultiple) {
        setSelectedAssets((current) => {
          const withoutOriginal = current.filter((asset) => asset.id !== cropAsset.id);
          return withoutOriginal.some((asset) => asset.id === croppedAsset.id)
            ? withoutOriginal
            : [...withoutOriginal, croppedAsset];
        });
      } else {
        onSelect?.(croppedAsset);
      }
      setCropAsset(null);
      if (!isMultiple) {
        onClose();
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingCrop(false);
    }
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
      if (previewAsset?.id === asset.id) {
        setPreviewAsset(null);
      }
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
                      <div className="flex items-center gap-3">
                        <button className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200" onClick={() => setPreviewAsset(asset)} type="button">
                          <Eye className="h-3.5 w-3.5" />
                          Preview
                        </button>
                        {isMultiple && allowCropInMultiple && canCropAsset(asset) ? (
                          <button className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800 ring-1 ring-amber-200 transition hover:bg-amber-200" onClick={() => openMultipleCropEditor(asset)} type="button">
                            <Crop className="h-3.5 w-3.5" />
                            Crop
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 ring-1 ring-rose-100 transition hover:bg-rose-100" disabled={deletingId === asset.id} onClick={() => void handleDelete(asset)} type="button">
                            <Trash2 className="h-3.5 w-3.5" />
                            {deletingId === asset.id ? 'Deleting...' : 'Delete'}
                          </button>
                        ) : null}
                      </div>
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
      <Modal
        description="Preview this media file before selecting or deleting it."
        onClose={() => setPreviewAsset(null)}
        open={Boolean(previewAsset)}
        size="lg"
        title={previewAsset?.label || previewAsset?.file_name || 'Preview media'}
      >
        {previewAsset ? (
          <div className="space-y-5">
            <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-950">
              {previewAsset.media_type === 'video' || previewAsset.mime_type?.startsWith('video/') ? (
                <video className="max-h-[70vh] w-full bg-slate-950 object-contain" controls preload="metadata" src={previewAsset.public_url} />
              ) : (
                <img
                  alt={previewAsset.alt_text || previewAsset.label || previewAsset.file_name}
                  className="max-h-[70vh] w-full object-contain"
                  decoding="async"
                  src={previewAsset.public_url}
                />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
              <span>{previewAsset.file_name}</span>
              <span>{formatFileSize(previewAsset.file_size_bytes)}</span>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <button className="button-secondary" onClick={() => setPreviewAsset(null)} type="button">
                Close
              </button>
              <button className="button-primary" onClick={() => handlePreviewSelect(previewAsset)} type="button">
                {isMultiple ? 'Toggle selection' : `Use ${acceptedAssetLabel}`}
              </button>
              {canDelete ? (
                <button className="button-danger gap-2" disabled={deletingId === previewAsset.id} onClick={() => void handleDelete(previewAsset)} type="button">
                  <Trash2 className="h-4 w-4" />
                  {deletingId === previewAsset.id ? 'Deleting...' : 'Delete'}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
      <Modal
        description="Keep the selected image as-is, or create a cropped copy and use that instead."
        onClose={() => setCropPromptAsset(null)}
        open={Boolean(cropPromptAsset)}
        title="Crop this image?"
      >
        {cropPromptAsset ? (
          <div className="space-y-5">
            <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50">
              <img
                alt={cropPromptAsset.alt_text || cropPromptAsset.label || cropPromptAsset.file_name}
                className="max-h-72 w-full object-contain"
                decoding="async"
                src={cropPromptAsset.public_url}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <button className="button-secondary" onClick={() => setCropPromptAsset(null)} type="button">
                Cancel
              </button>
              <button className="button-secondary" onClick={selectOriginalAsset} type="button">
                Use original
              </button>
              <button className="button-primary gap-2" onClick={openCropEditor} type="button">
                <Crop className="h-4 w-4" />
                Crop image
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
      <Modal
        description="Drag the crop box or pull a corner, then save it as a new cropped media item."
        onClose={() => setCropAsset(null)}
        open={Boolean(cropAsset)}
        title="Crop image"
        size="lg"
      >
        {cropAsset ? (
          <div className="space-y-6">
            <ToastMessage message={message} />
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-950 p-3 text-center">
              <div
                className="relative inline-block max-h-[60vh] max-w-full touch-none select-none overflow-hidden rounded-[1rem] align-middle sm:max-h-[32rem]"
                onPointerCancel={stopCropDrag}
                onPointerMove={handleCropPointerMove}
                onPointerUp={stopCropDrag}
                ref={cropSurfaceRef}
              >
                  <img
                    alt={cropAsset.alt_text || cropAsset.label || cropAsset.file_name}
                    className="block max-h-[60vh] max-w-full object-contain sm:max-h-[32rem]"
                    decoding="async"
                    draggable={false}
                    src={cropAsset.public_url}
                  />
                  <div className="absolute inset-0 bg-slate-950/35" />
                  <div
                    className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]"
                    onPointerDown={(event) => startCropDrag(event, 'move')}
                    style={{
                      left: `${cropArea.x}%`,
                      top: `${cropArea.y}%`,
                      width: `${cropArea.width}%`,
                      height: `${cropArea.height}%`,
                    }}
                  >
                    {[
                      { mode: 'nw' as const, className: '-left-2 -top-2 cursor-nwse-resize' },
                      { mode: 'ne' as const, className: '-right-2 -top-2 cursor-nesw-resize' },
                      { mode: 'sw' as const, className: '-bottom-2 -left-2 cursor-nesw-resize' },
                      { mode: 'se' as const, className: '-bottom-2 -right-2 cursor-nwse-resize' },
                    ].map((handle) => (
                      <span
                        aria-hidden="true"
                        className={`absolute h-5 w-5 rounded-full border-2 border-white bg-amber-500 shadow-lg ${handle.className}`}
                        key={handle.mode}
                        onPointerDown={(event) => startCropDrag(event, handle.mode)}
                      />
                    ))}
                    <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-white/50" />
                    <span className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-white/50" />
                  </div>
              </div>
            </div>
            <p className="text-sm leading-6 text-slate-500">Drag inside the box to move the crop. Drag any orange corner to resize it.</p>
            <div className="flex flex-wrap justify-end gap-3">
              <button className="button-secondary" disabled={savingCrop} onClick={() => setCropAsset(null)} type="button">
                Cancel
              </button>
              <button className="button-primary gap-2" disabled={savingCrop} onClick={() => void saveCroppedAsset()} type="button">
                {savingCrop ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Crop className="h-4 w-4" />}
                {savingCrop ? 'Saving...' : 'Save cropped'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </Modal>
  );
}
