import { FC, Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { useUpdatePhotoMutation } from '../../../store/api/galleryApi';
import type { Photo } from '../../../types/gallery';

interface EditPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  photo: Photo | null;
  albumId: string;
  onSuccess?: () => void;
}

const EditPhotoModal: FC<EditPhotoModalProps> = ({
  isOpen,
  onClose,
  photo,
  albumId,
  onSuccess,
}) => {
  const [caption, setCaption] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const [updatePhoto, { isLoading }] = useUpdatePhotoMutation();

  // Populate form when photo changes
  useEffect(() => {
    if (photo) {
      setCaption(photo.caption || '');
      setTags(photo.tags || []);
    }
  }, [photo]);

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (caption && caption.length > 500) {
      newErrors.caption = 'Caption must be less than 500 characters';
    }

    if (tags.length > 20) {
      newErrors.tags = 'Maximum 20 tags allowed';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!photo || !validate()) return;

    try {
      await updatePhoto({
        albumId,
        photoId: photo.id,
        data: {
          caption: caption.trim() || undefined,
          tags: tags.length > 0 ? tags : undefined,
        },
      }).unwrap();

      toast.success('Photo updated successfully');
      handleClose();
      onSuccess?.();
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to update photo');
    }
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < 20) {
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  if (!photo) return null;

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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                  <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white">
                    Edit Photo
                  </Dialog.Title>
                  <button
                    onClick={handleClose}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  {/* Photo Preview */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Photo Preview
                    </label>
                    <div className="w-full h-64 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                      <img
                        src={photo.url}
                        alt={photo.caption || 'Photo'}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>

                  {/* Caption */}
                  <div>
                    <label htmlFor="caption" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Caption
                    </label>
                    <textarea
                      id="caption"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      rows={4}
                      disabled={isLoading}
                      className={`w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border ${
                        errors.caption
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-gray-300 dark:border-gray-600 focus:ring-guild-500'
                      } rounded-lg focus:ring-2 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 resize-none disabled:opacity-50`}
                      placeholder="Add a caption for this photo..."
                      maxLength={500}
                    />
                    {errors.caption && <p className="mt-1 text-sm text-red-500">{errors.caption}</p>}
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {caption.length}/500 characters
                    </p>
                  </div>

                  {/* Tags */}
                  <div>
                    <label htmlFor="tagInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tag People (User IDs)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        id="tagInput"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={isLoading || tags.length >= 20}
                        className={`flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border ${
                          errors.tags
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-gray-300 dark:border-gray-600 focus:ring-guild-500'
                        } rounded-lg focus:ring-2 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 disabled:opacity-50`}
                        placeholder="Enter user ID and press Enter"
                      />
                      <button
                        type="button"
                        onClick={handleAddTag}
                        disabled={isLoading || !tagInput.trim() || tags.length >= 20}
                        className="px-4 py-2 bg-guild-600 hover:bg-guild-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add
                      </button>
                    </div>
                    {errors.tags && <p className="mt-1 text-sm text-red-500">{errors.tags}</p>}
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {tags.length}/20 tags • Press Enter or click Add
                    </p>

                    {/* Tagged Users List */}
                    {tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {tags.map((tag, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 bg-guild-100 dark:bg-guild-900/30 text-guild-700 dark:text-guild-300 px-3 py-1 rounded-full text-sm"
                          >
                            <span>{tag}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              disabled={isLoading}
                              className="text-guild-600 dark:text-guild-400 hover:text-guild-800 dark:hover:text-guild-200 transition-colors"
                            >
                              <XCircleIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Photo Info */}
                  {photo.metadata && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Photo Information
                      </h4>
                      <dl className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Format:</dt>
                          <dd className="text-gray-900 dark:text-white font-medium">
                            {photo.metadata.format}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Size:</dt>
                          <dd className="text-gray-900 dark:text-white font-medium">
                            {photo.metadata.sizeFormatted}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Original Name:</dt>
                          <dd className="text-gray-900 dark:text-white font-medium truncate ml-2">
                            {photo.metadata.originalName}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
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
                        'Save Changes'
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

export default EditPhotoModal;
