import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

function BaseModal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md',
  padding = 'p-6',
  className = '',
  showCloseButton = false
}) {
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel
                className={`w-full ${maxWidth} transform overflow-hidden rounded-2xl bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-700 text-left align-middle shadow-xl transition-all ${padding} ${className}`}
              >
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors focus:outline-none"
                    aria-label="Fechar"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}

                {title && (
                  <Dialog.Title as="h3" className="text-lg font-bold leading-6 text-gray-900 dark:text-white mb-4">
                    {title}
                  </Dialog.Title>
                )}

                {children}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export default BaseModal;
