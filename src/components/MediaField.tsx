import { useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { MediaPickerModal } from './MediaPickerModal';
import type { MediaAsset } from '../types/app';

interface MediaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
  previewHeightClassName?: string;
}

export function MediaField({
  label,
  value,
  onChange,
  helperText,
  previewHeightClassName = 'h-44',
}: MediaFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  function handleSelect(asset: MediaAsset) {
    onChange(asset.public_url);
    setPickerOpen(false);
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <label className="form-label mb-0">{label}</label>
            {helperText ? <p className="mt-1 text-xs leading-5 text-slate-500">{helperText}</p> : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
          <div className={`${previewHeightClassName} flex items-center justify-center bg-slate-50`}>
            {value ? (
              <img alt={label} className="h-full w-full object-cover" decoding="async" loading="lazy" src={value} />
            ) : (
              <div className="flex flex-col items-center gap-3 px-4 text-center text-sm text-slate-400">
                <ImagePlus className="h-6 w-6" />
                <span>No media selected</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3 border-t border-slate-100 px-4 py-4">
            <button className="button-secondary gap-2" onClick={() => setPickerOpen(true)} type="button">
              <ImagePlus className="h-4 w-4" />
              {value ? 'Change media' : 'Select media'}
            </button>
            {value ? (
              <button className="button-danger gap-2" onClick={() => onChange('')} type="button">
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <MediaPickerModal onClose={() => setPickerOpen(false)} onSelect={handleSelect} open={pickerOpen} selectedUrl={value} />
    </>
  );
}
