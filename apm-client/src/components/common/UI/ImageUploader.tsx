import { FC, useCallback, useState, DragEvent, ChangeEvent } from 'react';
import { CloudArrowUpIcon, XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline';

interface ImageUploaderProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number; // in MB
  accept?: string;
  multiple?: boolean;
  selectedFiles?: File[];
  onRemoveFile?: (index: number) => void;
}

const ImageUploader: FC<ImageUploaderProps> = ({
  onFilesSelected,
  maxFiles = 20,
  maxSize = 5,
  accept = 'image/jpeg,image/jpg,image/png,image/webp,image/gif',
  multiple = true,
  selectedFiles = [],
  onRemoveFile,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const validateFiles = (files: FileList | File[]): File[] => {
    const validFiles: File[] = [];
    const newErrors: string[] = [];
    const fileArray = Array.from(files);

    // Check total count
    if (selectedFiles.length + fileArray.length > maxFiles) {
      newErrors.push(`Maximum ${maxFiles} files allowed`);
      setErrors(newErrors);
      return validFiles;
    }

    fileArray.forEach((file) => {
      // Check file type
      if (!accept.split(',').some(type => file.type.match(type.replace('*', '.*')))) {
        newErrors.push(`${file.name}: Invalid file type`);
        return;
      }

      // Check file size
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSize) {
        newErrors.push(`${file.name}: File too large (max ${maxSize}MB)`);
        return;
      }

      validFiles.push(file);
    });

    setErrors(newErrors);
    return validFiles;
  };

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const validFiles = validateFiles(files);
        if (validFiles.length > 0) {
          onFilesSelected(validFiles);
        }
      }
    },
    [onFilesSelected, validateFiles]
  );

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const validFiles = validateFiles(files);
        if (validFiles.length > 0) {
          onFilesSelected(validFiles);
        }
      }
      // Reset input
      e.target.value = '';
    },
    [onFilesSelected, validateFiles]
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="w-full">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-8 sm:p-12 text-center transition-all ${
          isDragging
            ? 'border-guild-600 bg-guild-50 dark:bg-guild-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-guild-500 dark:hover:border-guild-500'
        }`}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInput}
        />

        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center justify-center"
        >
          <CloudArrowUpIcon
            className={`w-16 h-16 sm:w-20 sm:h-20 mb-4 transition-colors ${
              isDragging
                ? 'text-guild-600 dark:text-guild-400'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          />

          <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {isDragging ? 'Drop files here' : 'Drag & drop photos here'}
          </p>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            or click to browse
          </p>

          <p className="text-xs text-gray-400 dark:text-gray-500">
            {multiple ? `Max ${maxFiles} files` : '1 file'} • {maxSize}MB per file • JPG, PNG, WebP, GIF
          </p>
        </label>
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
            {errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Selected Files ({selectedFiles.length})
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Total: {formatFileSize(selectedFiles.reduce((acc, file) => acc + file.size, 0))}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="relative group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Preview Image */}
                <div className="aspect-square bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* File Info */}
                <div className="p-2">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatFileSize(file.size)}
                  </p>
                </div>

                {/* Remove Button */}
                {onRemoveFile && (
                  <button
                    onClick={() => onRemoveFile(index)}
                    className="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove file"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
