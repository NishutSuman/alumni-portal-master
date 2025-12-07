import { FC, Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { useGetAlbumsQuery, useBulkUploadPhotosMutation } from '../../../store/api/galleryApi';
import ImageUploader from '../../common/UI/ImageUploader';

interface UploadPhotosModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedAlbumId?: string;
  onSuccess?: () => void;
}

const UploadPhotosModal: FC<UploadPhotosModalProps> = ({
  isOpen,
  onClose,
  preselectedAlbumId,
  onSuccess,
}) => {
  const [selectedAlbumId, setSelectedAlbumId] = useState(preselectedAlbumId || '');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const { data: albumsData } = useGetAlbumsQuery({ limit: 100, includeArchived: false });
  const [bulkUpload, { isLoading }] = useBulkUploadPhotosMutation();

  const albums = albumsData?.data.albums || [];

  // Set preselected album when it changes
  useEffect(() => {
    if (preselectedAlbumId) {
      setSelectedAlbumId(preselectedAlbumId);
    }
  }, [preselectedAlbumId]);

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!selectedAlbumId) {
      newErrors.album = 'Please select an album';
    }

    if (selectedFiles.length === 0) {
      newErrors.files = 'Please select at least one photo';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      // Start progress
      setUploadProgress(10);

      // Simulate upload progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) return prev; // Stop at 90% until actual upload completes
          return prev + 10;
        });
      }, 300); // Update every 300ms

      const result = await bulkUpload({
        albumId: selectedAlbumId,
        data: {
          photos: selectedFiles,
        },
      }).unwrap();

      // Clear interval and set to 100%
      clearInterval(progressInterval);
      setUploadProgress(100);

      const uploaded = result.data.uploaded.length;
      const failed = result.data.failed.length;

      // Show success message
      if (failed > 0) {
        toast.success(`Uploaded ${uploaded} photos. ${failed} failed.`, { duration: 4000 });
      } else {
        toast.success(`Successfully uploaded ${uploaded} photo${uploaded > 1 ? 's' : ''}!`, { duration: 3000 });
      }

      // Wait a moment to show 100% progress, then close
      setTimeout(() => {
        handleClose();
        onSuccess?.();
      }, 500);
    } catch (error: any) {
      setUploadProgress(0);
      toast.error(error?.data?.message || 'Failed to upload photos');
    }
  };

  const handleClose = () => {
    setSelectedFiles([]);
    setUploadProgress(0);
    setErrors({});
    if (!preselectedAlbumId) {
      setSelectedAlbumId('');
    }
    onClose();
  };

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles((prev) => [...prev, ...files]);
    setErrors((prev) => ({ ...prev, files: '' }));
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const totalSize = selectedFiles.reduce((acc, file) => acc + file.size, 0);
  const formattedTotalSize = (totalSize / (1024 * 1024)).toFixed(2);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl max-h-[90vh] flex flex-col transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl transition-all">
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                  <div>
                    <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white">
                      Upload Photos
                    </Dialog.Title>
                    {selectedFiles.length > 0 && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected • {formattedTotalSize} MB
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleClose}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    disabled={isLoading}
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                {/* Form - Scrollable */}
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                  {/* Album Selection */}
                  <div>
                    <label htmlFor="album" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Album <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="album"
                      value={selectedAlbumId}
                      onChange={(e) => {
                        setSelectedAlbumId(e.target.value);
                        setErrors((prev) => ({ ...prev, album: '' }));
                      }}
                      disabled={!!preselectedAlbumId || isLoading}
                      className={`w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border ${
                        errors.album
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-gray-300 dark:border-gray-600 focus:ring-guild-500'
                      } rounded-lg focus:ring-2 focus:border-transparent text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <option value="">-- Select an album --</option>
                      {albums.map((album) => (
                        <option key={album.id} value={album.id}>
                          {album.name} ({album._count?.photos || 0} photos)
                        </option>
                      ))}
                    </select>
                    {errors.album && <p className="mt-1 text-sm text-red-500">{errors.album}</p>}
                  </div>

                  {/* File Uploader */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Photos <span className="text-red-500">*</span>
                    </label>
                    <ImageUploader
                      onFilesSelected={handleFilesSelected}
                      maxFiles={20}
                      maxSize={5}
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                      multiple={true}
                      selectedFiles={selectedFiles}
                      onRemoveFile={handleRemoveFile}
                    />
                    {errors.files && <p className="mt-2 text-sm text-red-500">{errors.files}</p>}
                  </div>

                  {/* Upload Progress */}
                  {isLoading && uploadProgress > 0 && (
                    <div>
                      <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300 mb-2">
                        <span>Uploading photos...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-guild-600 h-2.5 transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  </div>

                  {/* Actions - Fixed at bottom */}
                  <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading || selectedFiles.length === 0}
                      className="px-6 py-2 bg-guild-600 hover:bg-guild-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Uploading...
                        </>
                      ) : (
                        <>Upload {selectedFiles.length} Photo{selectedFiles.length !== 1 ? 's' : ''}</>
                      )}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default UploadPhotosModal;
