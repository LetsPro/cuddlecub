import { useEffect, useRef, useState } from 'react';
import { ImagePlus, LoaderCircle, PencilLine, Trash2 } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { useAppContext } from '../../lib/app-context';
import { deleteMediaAsset, formatFileSize, listMediaAssets, updateMediaAsset, uploadMediaAssets } from '../../lib/media';
import { getErrorMessage } from '../../lib/supabase';
import { ToastMessage } from '../../lib/toast';
import { formatDateTime } from '../../lib/utils';
import type { MediaAsset } from '../../types/app';

const emptyEditForm = {
  label: '',
  alt_text: '',
};

export function MediaPage() {
  const { profile, school } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);

  useEffect(() => {
    void loadAssets();
  }, [school.id]);

  async function loadAssets() {
    setLoading(true);
    setMessage(null);

    try {
      const nextAssets = await listMediaAssets(school.id);
      setAssets(nextAssets);
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
      const uploadedAssets = await uploadMediaAssets({
        schoolId: school.id,
        userId: profile.user_id,
        files,
      });

      setAssets((current) => [...uploadedAssets, ...current]);
      setMessage(`${uploadedAssets.length} ${uploadedAssets.length === 1 ? 'image' : 'images'} uploaded.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  function openEditModal(asset: MediaAsset) {
    setEditingAsset(asset);
    setEditForm({
      label: asset.label ?? '',
      alt_text: asset.alt_text ?? '',
    });
  }

  function closeEditModal() {
    setEditingAsset(null);
    setEditForm(emptyEditForm);
  }

  async function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAsset) return;

    setMessage(null);

    try {
      const updated = await updateMediaAsset(editingAsset.id, {
        label: editForm.label || null,
        alt_text: editForm.alt_text || null,
      });

      setAssets((current) => current.map((asset) => (asset.id === updated.id ? updated : asset)));
      closeEditModal();
      setMessage('Media details updated.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleDelete(asset: MediaAsset) {
    const confirmed = window.confirm(`Delete ${asset.label || asset.file_name}?`);
    if (!confirmed) return;

    setBusyDeleteId(asset.id);
    setMessage(null);

    try {
      await deleteMediaAsset(asset);
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      if (editingAsset?.id === asset.id) {
        closeEditModal();
      }
      setMessage('Media deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyDeleteId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Media Library"
        title="Upload, edit and manage shared media"
        description="Centralize school logos, website slider images, gallery photos, and profile pictures so admin can reuse media anywhere in the app."
        actions={
          <button className="button-primary gap-2" disabled={uploading} onClick={() => fileInputRef.current?.click()} type="button">
            {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {uploading ? 'Uploading...' : 'Upload media'}
          </button>
        }
      />

      <input accept="image/*" className="hidden" multiple onChange={handleUpload} ref={fileInputRef} type="file" />
      <ToastMessage message={message} />

      <SectionCard
        title="Media library"
        description="These files can be selected from admin forms through the media modal."
        action={
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{assets.length} files</span>
          </div>
        }
      >
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
        ) : assets.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500">
            Upload the first school logo or gallery image to start the shared media library.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => (
              <article key={asset.id} className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
                <div className="h-56 bg-slate-100">
                  <img alt={asset.alt_text || asset.label || asset.file_name} className="h-full w-full object-cover" decoding="async" loading="lazy" src={asset.public_url} />
                </div>
                <div className="space-y-4 p-5">
                  <div>
                    <p className="truncate text-lg font-bold text-slate-900">{asset.label || asset.file_name}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{asset.file_name}</p>
                  </div>
                  <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                    <p>{formatFileSize(asset.file_size_bytes)}</p>
                    <p>{formatDateTime(asset.created_at)}</p>
                  </div>
                  {asset.alt_text ? <p className="text-sm leading-6 text-slate-600">{asset.alt_text}</p> : null}
                  <div className="flex flex-wrap gap-3 pt-1">
                    <button className="button-secondary gap-2" onClick={() => openEditModal(asset)} type="button">
                      <PencilLine className="h-4 w-4" />
                      Edit
                    </button>
                    <button className="button-danger gap-2" disabled={busyDeleteId === asset.id} onClick={() => void handleDelete(asset)} type="button">
                      <Trash2 className="h-4 w-4" />
                      {busyDeleteId === asset.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <Modal description="Update the internal label and alternate text used for this media file." onClose={closeEditModal} open={Boolean(editingAsset)} title="Edit media">
        <form className="grid gap-4" onSubmit={handleEditSubmit}>
          <div>
            <label className="form-label">Label</label>
            <input className="form-input" onChange={(event) => setEditForm((current) => ({ ...current, label: event.target.value }))} value={editForm.label} />
          </div>
          <div>
            <label className="form-label">Alt text</label>
            <textarea className="form-input min-h-28" onChange={(event) => setEditForm((current) => ({ ...current, alt_text: event.target.value }))} value={editForm.alt_text} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="button-secondary" onClick={closeEditModal} type="button">
              Cancel
            </button>
            <button className="button-primary" type="submit">
              Save changes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
