import { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

function MantisModal({ isOpen, onClose, onSubmit }) {
  const [link, setLink] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(link); // Envia o link (mesmo que esteja vazio)
    setLink('');
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30" />
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900"
                >
                  Registrar Erro
                </Dialog.Title>
                <form onSubmit={handleSubmit}>
                  <div className="mt-4">
                    <label htmlFor="mantisLink" className="block text-sm font-medium text-gray-700">
                      Link do Mantis (Opcional)
                    </label>
                    <input
                      type="url"
                      id="mantisLink"
                      className="mt-1 block w-full input-style"
                      placeholder="https://mantis.suaempresa.com/view.php?id=123"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      // O ATRIBUTO 'required' FOI REMOVIDO
                    />
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                      onClick={onClose}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                    >
                      Salvar Erro
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
}

export default MantisModal;