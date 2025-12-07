import { FC, Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { useGetAlbumsQuery, useMovePhotosMutation } from '../../../store/api/galleryApi';

interface MovePhotosModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAlbumId: string;
  photoIds: string[];
  onSuccess?: () => void;
}

const MovePhotosModal: FC<MovePhotosModalProps> = ({
  isOpen,
  onClose,
  currentAlbumId,
  photoIds,
  onSuccess,
}) => {
  const [targetAlbumId, setTargetAlbumId] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const { data: albumsData } = useGetAlbumsQuery({ limit: 100, includeArchived: false });
  const [movePhotos, { isLoading }] = useMovePhotosMutation();

  const albums = albumsData?.data.albums.filter((album) => album.id !== currentAlbumId) || [];

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!targetAlbumId) {
      newErrors.album = 'Please select a target album';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      const result = await movePhotos({
        albumId: currentAlbumId,
        data: {
          photoIds,
          targetAlbumId,
        },
      }).unwrap();

      const moved = result.data.moved;
      const failed = result.data.failed;

      if (failed > 0) {
        toast.success(`Moved ${moved} photos. ${failed} failed.`, { duration: 4000 });
      } else {
        toast.success(`Successfully moved ${moved} photos!`);
      }

      handleClose();
      onSuccess?.();
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to move photos');
    }
  };

  const handleClose = () => {
    setTargetAlbumId('');
    setErrors({});
    onClose();
  };

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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <ArrowsRightLeftIcon className="w-6 h-6 text-guild-600 dark:text-guild-400" />
                    <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white">
                      Move Photos
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={handleClose}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  {/* Info */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      You are about to move{' '}
                      <span className="font-semibold">{photoIds.length}</span> photo
                      {photoIds.length !== 1 ? 's' : ''} to a different album.
                    </p>
                  </div>

                  {/* Target Album Selection */}
                  <div>
                    <label htmlFor="targetAlbum" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Move to Album <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="targetAlbum"
                      value={targetAlbumId}
                      onChange={(e) => {
                        setTargetAlbumId(e.target.value);
                        setErrors((prev) => ({ ...prev, album: '' }));
                      }}
                      disabled={isLoading}
                      className={`w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border ${
                        errors.album
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-gray-300 dark:border-gray-600 focus:ring-guild-500'
                      } rounded-lg focus:ring-2 focus:border-transparent text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <option value="">-- Select target album --</option>
                      {albums.map((album) => (
                        <option key={album.id} value={album.id}>
                          {album.name} ({album._count?.photos || 0} photos)
                        </option>
                      ))}
                    </select>
                    {errors.album && <p className="mt-1 text-sm text-red-500">{errors.album}</p>}
                    {albums.length === 0 && (
                      <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
                        No other albums available. Create a new album first.
                      </p>
                    )}
                  </div>

                  {/* Warning */}
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>Note:</strong> This action will move the selected photos to the target
                      album. This cannot be undone easily.
                    </p>
                  </div>

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
                      disabled={isLoading || albums.length === 0}
                      className="px-6 py-2 bg-guild-600 hover:bg-guild-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Moving...
                        </>
                      ) : (
                        <>
                          <ArrowsRightLeftIcon className="w-4 h-4" />
                          Move Photos
                        </>
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

export default MovePhotosModal;
