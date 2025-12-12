import { FC, Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { useUpdateAlbumMutation, useGetAlbumQuery } from '../../../store/api/galleryApi';
import ImageUploader from '../../common/UI/ImageUploader';
import type { Album } from '../../../types/gallery';
import { getApiUrl } from '@/utils/helpers';

interface EditAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  album: Album | null;
  onSuccess?: () => void;
}

const EditAlbumModal: FC<EditAlbumModalProps> = ({ isOpen, onClose, album, onSuccess }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [isArchived, setIsArchived] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [coverImageKey, setCoverImageKey] = useState(0); // Key to force re-render of cover image

  const [updateAlbum, { isLoading }] = useUpdateAlbumMutation();

  // Fetch the latest album data when modal is open
  const { data: latestAlbumData } = useGetAlbumQuery(
    { albumId: album?.id || '', includePhotos: false },
    { skip: !album?.id || !isOpen }
  );

  const currentAlbum = latestAlbumData?.data.album || album;

  // Populate form when album changes
  useEffect(() => {
    if (currentAlbum) {
      setName(currentAlbum.name);
      setDescription(currentAlbum.description || '');
      setIsArchived(currentAlbum.isArchived);
      setCoverImage(null); // Reset cover image file
      setCoverImageKey(prev => prev + 1); // Force re-render of cover image
    }
  }, [currentAlbum?.updatedAt, currentAlbum?.id]);

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Album name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Album name must be at least 2 characters';
    } else if (name.trim().length > 100) {
      newErrors.name = 'Album name must be less than 100 characters';
    }

    if (description && description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentAlbum || !validate()) return;

    try {
      await updateAlbum({
        albumId: currentAlbum.id,
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
          isArchived,
          coverImage: coverImage || undefined,
        },
      }).unwrap();

      toast.success('Album updated successfully');
      handleClose();
      onSuccess?.();
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to update album');
    }
  };

  const handleClose = () => {
    setErrors({});
    setCoverImage(null);
    onClose();
  };

  const handleFilesSelected = (files: File[]) => {
    if (files.length > 0) {
      setCoverImage(files[0]);
    }
  };

  const handleRemoveFile = () => {
    setCoverImage(null);
  };

  if (!album) return null;

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
              <Dialog.Panel className="w-full max-w-2xl max-h-[90vh] flex flex-col transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl transition-all">
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                  <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white">
                    Edit Album
                  </Dialog.Title>
                  <button
                    onClick={handleClose}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                {/* Form - Scrollable */}
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                  {/* Album Name */}
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Album Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={`w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border ${
                        errors.name
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-gray-300 dark:border-gray-600 focus:ring-guild-500'
                      } rounded-lg focus:ring-2 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500`}
                      placeholder="e.g., Graduation 2024"
                      maxLength={100}
                    />
                    {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {name.length}/100 characters
                    </p>
                  </div>

                  {/* Description */}
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      className={`w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border ${
                        errors.description
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-gray-300 dark:border-gray-600 focus:ring-guild-500'
                      } rounded-lg focus:ring-2 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 resize-none`}
                      placeholder="Optional description for this album..."
                      maxLength={500}
                    />
                    {errors.description && <p className="mt-1 text-sm text-red-500">{errors.description}</p>}
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {description.length}/500 characters
                    </p>
                  </div>

                  {/* Archive Status */}
                  <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <input
                      type="checkbox"
                      id="isArchived"
                      checked={isArchived}
                      onChange={(e) => setIsArchived(e.target.checked)}
                      className="w-5 h-5 text-guild-600 bg-gray-100 border-gray-300 rounded focus:ring-guild-500 dark:focus:ring-guild-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <label htmlFor="isArchived" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                      Archive this album (hide from active listings)
                    </label>
                  </div>

                  {/* Current Cover Image */}
                  {currentAlbum?.coverImage && !coverImage && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Current Cover Image
                      </label>
                      <div className="relative w-full h-48 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                        <img
                          key={coverImageKey}
                          src={getApiUrl(`/api/albums/cover/${currentAlbum.id}?t=${new Date(currentAlbum.updatedAt).getTime()}`)}
                          alt={currentAlbum.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Upload a new image below to replace the current cover
                      </p>
                    </div>
                  )}

                  {/* New Cover Image */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {album.coverImage && !coverImage ? 'Replace Cover Image' : 'Cover Image'}
                    </label>
                    <ImageUploader
                      onFilesSelected={handleFilesSelected}
                      maxFiles={1}
                      maxSize={3}
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      multiple={false}
                      selectedFiles={coverImage ? [coverImage] : []}
                      onRemoveFile={handleRemoveFile}
                    />
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Max 3MB • JPG, PNG, WebP
                    </p>
                  </div>

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
                      disabled={isLoading}
                      className="px-6 py-2 bg-guild-600 hover:bg-guild-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Updating...
                        </>
                      ) : (
                        'Update Album'
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

export default EditAlbumModal;
