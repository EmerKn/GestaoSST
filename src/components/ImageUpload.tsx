import React from 'react';
import { Camera, Image as ImageIcon, FileText, MonitorPlay } from 'lucide-react';

interface ImageUploadProps {
  label: React.ReactNode;
  name?: string;
  currentImage?: string | null;
  onImageSelect: (file: File, name?: string) => void;
  required?: boolean;
  accept?: string;
  onWebcamClick?: () => void;
}

export function ImageUpload({ label, name, currentImage, onImageSelect, required, accept = "image/*", onWebcamClick }: ImageUploadProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageSelect(file, name);
    }
    // Reset input so the same file can be selected again if needed
    e.target.value = '';
  };

  const isPdfAllowed = accept.includes('.pdf');

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex gap-2">
        {onWebcamClick && (
          <button 
            type="button"
            onClick={onWebcamClick}
            className="flex-1 flex items-center justify-center gap-2 p-2 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors text-sm font-medium cursor-pointer"
          >
            <MonitorPlay className="w-4 h-4" /> Webcam
          </button>
        )}
        <label className="flex-1 flex items-center justify-center gap-2 p-2 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors text-sm font-medium cursor-pointer">
          <Camera className="w-4 h-4" /> Câmera
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            onChange={handleFileChange} 
            className="hidden" 
          />
        </label>
        <label className="flex-1 flex items-center justify-center gap-2 p-2 bg-gray-50 text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors text-sm font-medium cursor-pointer">
          {isPdfAllowed ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />} 
          {isPdfAllowed ? 'Arquivo' : 'Galeria'}
          <input 
            type="file" 
            accept={accept} 
            onChange={handleFileChange} 
            className="hidden" 
          />
        </label>
      </div>
      
      {/* Required field hidden input for form validation if needed */}
      {required && !currentImage && (
        <input type="text" required className="opacity-0 w-0 h-0 absolute" />
      )}

      {currentImage && (
        <div className="mt-2 relative inline-block">
          {currentImage.startsWith('data:application/pdf') ? (
             <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
               <FileText className="w-6 h-6 text-red-500" />
               <span className="text-sm font-medium text-gray-700">Arquivo PDF anexado</span>
             </div>
          ) : (
            <img src={currentImage} alt="Preview" className="h-24 object-cover rounded-lg border border-gray-200" />
          )}
        </div>
      )}
    </div>
  );
}
