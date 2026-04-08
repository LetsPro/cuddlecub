import { supabase } from './supabase';
import type { MediaAsset } from '../types/app';

export const MEDIA_BUCKET = 'school-media';
const MAX_IMAGE_DIMENSION = 1920;
const OPTIMIZED_IMAGE_TYPE = 'image/webp';
const OPTIMIZED_IMAGE_QUALITY = 0.84;

function sanitizeFileName(fileName: string) {
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  const cleaned = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return cleaned || 'media';
}

function getFileExtension(file: File) {
  const matched = file.name.match(/\.[a-z0-9]+$/i);
  return matched?.[0]?.toLowerCase() ?? '';
}

function buildStoragePath(schoolId: string, file: File) {
  const today = new Date().toISOString().slice(0, 10);
  const extension = getFileExtension(file);
  return `${schoolId}/${today}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}${extension}`;
}

function deriveLabel(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, '');
}

function isDirectMediaUrl(value: string) {
  return /^(https?:|data:|blob:)/i.test(value);
}

function shouldOptimizeImage(file: File) {
  return file.type.startsWith('image/') && file.type !== 'image/svg+xml' && file.type !== 'image/gif';
}

function loadImageElement(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image could not be processed.'));
    image.src = source;
  });
}

async function optimizeImageFile(file: File) {
  if (typeof window === 'undefined' || !shouldOptimizeImage(file)) {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(objectUrl);
    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = longestSide > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / longestSide : 1;
    const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
    const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      return file;
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, OPTIMIZED_IMAGE_TYPE, OPTIMIZED_IMAGE_QUALITY);
    });

    if (!blob) {
      return file;
    }

    const optimizedFile = new File([blob], `${deriveLabel(file.name)}.webp`, {
      type: OPTIMIZED_IMAGE_TYPE,
      lastModified: file.lastModified,
    });

    return optimizedFile.size < file.size || scale < 1 ? optimizedFile : file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function uploadPreparedMediaAsset({
  schoolId,
  userId,
  file,
  label,
  altText,
}: {
  schoolId: string;
  userId: string;
  file: File;
  label?: string | null;
  altText?: string | null;
}) {
  const preparedFile = await optimizeImageFile(file);
  const storagePath = buildStoragePath(schoolId, preparedFile);
  const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(storagePath, preparedFile, {
    cacheControl: '31536000',
    contentType: preparedFile.type || undefined,
    upsert: false,
  });

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);

  const payload = {
    school_id: schoolId,
    storage_path: storagePath,
    public_url: publicUrl,
    file_name: preparedFile.name,
    mime_type: preparedFile.type || null,
    file_size_bytes: preparedFile.size,
    media_type: preparedFile.type.startsWith('image/') ? 'image' : 'file',
    label: label || deriveLabel(file.name),
    alt_text: altText || null,
    created_by: userId,
  };

  const { data, error } = await supabase.from('media_assets').insert(payload).select('*').single();

  if (error) {
    await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
    throw error;
  }

  return data as MediaAsset;
}

export async function listMediaAssets(schoolId: string) {
  const { data, error } = await supabase.from('media_assets').select('*').eq('school_id', schoolId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MediaAsset[];
}

export async function uploadMediaAsset({
  schoolId,
  userId,
  file,
  label,
  altText,
}: {
  schoolId: string;
  userId: string;
  file: File;
  label?: string | null;
  altText?: string | null;
}) {
  return uploadPreparedMediaAsset({ schoolId, userId, file, label, altText });
}

export async function uploadMediaAssets({
  schoolId,
  userId,
  files,
}: {
  schoolId: string;
  userId: string;
  files: File[];
}) {
  const uploadedAssets: MediaAsset[] = [];

  for (const file of files) {
    const asset = await uploadPreparedMediaAsset({
      schoolId,
      userId,
      file,
    });

    uploadedAssets.push(asset);
  }

  return uploadedAssets;
}

export async function updateMediaAsset(assetId: string, updates: { label?: string | null; alt_text?: string | null }) {
  const { data, error } = await supabase.from('media_assets').update(updates).eq('id', assetId).select('*').single();
  if (error) throw error;
  return data as MediaAsset;
}

export async function deleteMediaAsset(asset: Pick<MediaAsset, 'id' | 'storage_path'>) {
  const { error: storageError } = await supabase.storage.from(MEDIA_BUCKET).remove([asset.storage_path]);
  if (storageError) throw storageError;

  const { error } = await supabase.from('media_assets').delete().eq('id', asset.id);
  if (error) throw error;
}

export function resolveMediaUrl(value: string | null | undefined) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return '';
  }

  if (isDirectMediaUrl(normalizedValue)) {
    return normalizedValue;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(normalizedValue.replace(/^\/+/, ''));

  return publicUrl;
}

export function formatFileSize(size: number | null | undefined) {
  if (!size) return 'Unknown size';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
