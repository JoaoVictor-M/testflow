import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Menu, Transition } from '@headlessui/react'
import { Toaster } from 'react-hot-toast'
import { useContext, Fragment } from 'react'

import { AuthProvider, AuthContext } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ThemeToggle from './components/ThemeToggle'
import PrivateRoute from './components/PrivateRoute'

import WelcomePage from './pages/WelcomePage'
import ProjectsListPage from './pages/ProjectsListPage'
import DemandasListPage from './pages/DemandasListPage'
import ScenariosListPage from './pages/ScenariosListPage'
import DashboardPage from './pages/DashboardPage'
import ManageTagsPage from './pages/ManageTagsPage'
import Login from './pages/Login'
import UsersManager from './pages/UsersManager'
import EmailSettings from './pages/EmailSettings'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'



// --- ÍCONES ---
const ChevronDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

function Navbar() {
  const { user, logout } = useContext(AuthContext);

  if (!user) return null;

  return (

    <nav className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md shadow-sm border-b border-gray-200 dark:border-neutral-800 fixed w-full top-0 z-50 transition-colors duration-300">
      <div className="w-[95%] mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold text-blue-600 dark:text-blue-500 flex items-center hover:opacity-80 transition-opacity">
          TestFlow
        </Link>
        <div className="flex items-center space-x-6">

          <Menu as="div" className="relative inline-block text-left">
            <div>
              <Menu.Button className="flex items-center text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 font-medium px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">
                Gerenciamento
                <ChevronDownIcon />
              </Menu.Button>
            </div>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right divide-y divide-gray-100 dark:divide-neutral-700 rounded-lg bg-white dark:bg-neutral-800 shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none border border-gray-100 dark:border-neutral-700">
                <div className="px-1 py-1">
                  <Menu.Item>
                    {({ active }) => (
                      <Link
                        to="/projects"
                        className={`${active ? 'bg-blue-600 text-white' : 'text-gray-900 dark:text-neutral-200'
                          } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                      >
                        Projetos
                      </Link>
                    )}
                  </Menu.Item>
                  {(user.role === 'admin' || user.role === 'qa') && (
                    <>
                      <Menu.Item>
                        {({ active }) => (
                          <Link
                            to="/users"
                            className={`${active ? 'bg-blue-600 text-white' : 'text-gray-900 dark:text-neutral-200'
                              } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                          >
                            Usuários
                          </Link>
                        )}
                      </Menu.Item>
                      {user.role === 'admin' && (
                        <Menu.Item>
                          {({ active }) => (
                            <Link
                              to="/email-settings"
                              className={`${active ? 'bg-blue-600 text-white' : 'text-gray-900 dark:text-neutral-200'
                                } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                            >
                              Configurações de Email
                            </Link>
                          )}
                        </Menu.Item>
                      )}
                    </>
                  )}
                </div>
              </Menu.Items>
            </Transition>
          </Menu>

          <Menu as="div" className="relative inline-block text-left">
            <div>
              <Menu.Button className="flex items-center text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 font-medium px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">
                Visualização
                <ChevronDownIcon />
              </Menu.Button>
            </div>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right divide-y divide-gray-100 dark:divide-neutral-700 rounded-lg bg-white dark:bg-neutral-800 shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none border border-gray-100 dark:border-neutral-700">
                <div className="px-1 py-1">
                  <Menu.Item>
                    {({ active }) => (
                      <Link
                        to="/dashboard"
                        className={`${active ? 'bg-blue-600 text-white' : 'text-gray-900 dark:text-neutral-200'
                          } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                      >
                        Dashboard
                      </Link>
                    )}
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>

          <div className="h-6 w-px bg-gray-300 dark:bg-neutral-600 mx-2"></div>

          {/* MENU USUÁRIO */}
          <Menu as="div" className="relative inline-block text-left">
            <div>
              <Menu.Button className="flex items-center text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 font-bold text-base px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">
                <span className="mr-2">
                  {user.name && user.name.split(' ').length > 1
                    ? `${user.name.split(' ')[0]} ${user.name.split(' ').pop()}`
                    : user.name || user.username}
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 dark:text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                <ChevronDownIcon />
              </Menu.Button>
            </div>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              {/* Ajuste: mt-1, w-full para acompanhar o botão pai, mas w-40 fixo pode ser melhor se o nome for grande. 
                  O user pediu "lateralmente rente a risquinho". O risquinho está aa esquerda do menu.
                  Então right-0 mantem na direita.
                  Vou reduzir o width para w-32 ou w-full do parent. */}
              <Menu.Items className="absolute right-0 mt-1 w-full min-w-[200px] origin-top-right divide-y divide-gray-100 dark:divide-neutral-700 rounded-lg bg-white dark:bg-neutral-800 shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none border border-gray-100 dark:border-neutral-700">
                <div className="px-1 py-1">
                  <Menu.Item>
                    {({ active }) => (
                      <div className="flex items-center justify-between px-2 py-2">
                        <span className="text-sm text-gray-700 dark:text-neutral-200 font-medium">Tema Escuro</span>
                        <ThemeToggle />
                      </div>
                    )}
                  </Menu.Item>
                </div>
                <div className="px-1 py-1">
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={logout}
                        className={`${active ? 'bg-red-500 text-white' : 'text-gray-900 dark:text-neutral-200'
                          } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sair
                      </button>
                    )}
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
      </div>
    </nav>
  );
}

function AppContent() {
  const location = useLocation();
  const isPublicPage = ['/login', '/forgot-password', '/reset-password'].some(path => location.pathname.startsWith(path));

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-neutral-950">
      {!isPublicPage && <Navbar />}

      <main className={`w-[95%] mx-auto flex-grow ${isPublicPage ? '' : 'py-8 pt-24'}`}>
        <div className={`${isPublicPage ? 'max-w-md mx-auto' : 'bg-white dark:bg-neutral-900 shadow-lg rounded-lg border border-gray-200 dark:border-neutral-800 p-6 md:p-8 min-h-[calc(100vh-8rem)]'}`}>

          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />

            <Route element={<PrivateRoute />}>
              <Route path="/" element={<WelcomePage />} />
              <Route path="/projects" element={<ProjectsListPage />} />
              <Route path="/project/:projectId/demandas" element={<DemandasListPage />} />
              <Route path="/demanda/:demandaId/scenarios" element={<ScenariosListPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/tags" element={<ManageTagsPage />} />
            </Route>

            <Route element={<PrivateRoute requiredRole={['admin', 'qa']} />}>
              <Route path="/users" element={<UsersManager />} />
            </Route>

            <Route element={<PrivateRoute requiredRole="admin" />}>
              <Route path="/email-settings" element={<EmailSettings />} />
            </Route>

          </Routes>
        </div>
      </main>



      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#333',
            color: '#fff',
          },
        }}
      />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;