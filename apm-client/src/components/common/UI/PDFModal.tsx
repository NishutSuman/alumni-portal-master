// components/common/UI/PDFModal.tsx
import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import PDFViewer from './PDFViewer';

interface PDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
  title?: string;
}

const PDFModal: React.FC<PDFModalProps> = React.memo(({
  isOpen,
  onClose,
  fileUrl,
  fileName,
  title
}) => {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-75" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          {/* Desktop Layout */}
          <div className="hidden md:flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 dark:text-white"
                  >
                    {title || fileName}
                  </Dialog.Title>
                  <button
                    type="button"
                    className="rounded-md p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                {/* PDF Viewer */}
                <div className="max-h-[80vh] overflow-auto">
                  {isOpen && (
                    <PDFViewer
                      key={fileUrl}
                      fileUrl={fileUrl}
                      fileName={fileName}
                      maxWidth={800}
                      maxHeight={1000}
                      showControls={true}
                      showZoom={true}
                      className="w-full"
                    />
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>

          {/* Mobile Full Screen Layout */}
          <div className="md:hidden">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-full"
              enterTo="opacity-100 translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-full"
            >
              <Dialog.Panel className="fixed inset-0 bg-white dark:bg-gray-900 flex flex-col">
                {/* Mobile Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <button
                    type="button"
                    className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    onClick={onClose}
                  >
                    <XMarkIcon className="h-6 w-6 mr-2" />
                    <span className="font-medium">Back</span>
                  </button>
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium text-gray-900 dark:text-white truncate max-w-48"
                  >
                    {title || fileName}
                  </Dialog.Title>
                  <div className="w-16"></div> {/* Spacer for centering title */}
                </div>

                {/* Mobile PDF Viewer */}
                <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900">
                  {isOpen && (
                    <PDFViewer
                      key={fileUrl}
                      fileUrl={fileUrl}
                      fileName={fileName}
                      maxWidth={window.innerWidth - 20}
                      maxHeight={window.innerHeight - 100}
                      showControls={true}
                      showZoom={true}
                      className="w-full h-full"
                      theme="dark"
                    />
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
});

PDFModal.displayName = 'PDFModal';

export default PDFModal;