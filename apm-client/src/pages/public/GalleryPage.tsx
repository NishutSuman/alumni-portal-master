import { FC } from 'react';
import { PhotoIcon } from '@heroicons/react/24/outline';

const GalleryPage: FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center px-4">
        <PhotoIcon className="w-20 h-20 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Gallery Coming Soon
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          The public gallery page is currently under development
        </p>
      </div>
    </div>
  );
};

export default GalleryPage;
