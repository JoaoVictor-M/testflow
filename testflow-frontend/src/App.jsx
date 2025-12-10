import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Menu, Transition } from '@headlessui/react'
import { Toaster } from 'react-hot-toast'
import { useContext, Fragment } from 'react'

import { AuthProvider, AuthContext } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'

import WelcomePage from './pages/WelcomePage'
import ProjectsListPage from './pages/ProjectsListPage'
import DemandasListPage from './pages/DemandasListPage'
import ScenariosListPage from './pages/ScenariosListPage'
import DashboardPage from './pages/DashboardPage'
import ManageTagsPage from './pages/ManageTagsPage'
import Login from './pages/Login'
import UsersManager from './pages/UsersManager'



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
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="w-[95%] mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold text-blue-600 flex items-center hover:opacity-80 transition-opacity">
          TestFlow
        </Link>
        <div className="flex items-center space-x-6">

          {/* MENU GERENCIAMENTO */}
          <Menu as="div" className="relative inline-block text-left">
            <div>
              <Menu.Button className="flex items-center text-gray-700 hover:text-blue-600 font-medium px-3 py-2 rounded-md hover:bg-gray-50 transition-colors">
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
              <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div className="px-1 py-1">
                  <Menu.Item>
                    {({ active }) => (
                      <Link
                        to="/projects"
                        className={`${active ? 'bg-blue-600 text-white' : 'text-gray-900'
                          } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                      >
                        Projetos
                      </Link>
                    )}
                  </Menu.Item>
                  {user.role === 'admin' && (
                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          to="/users"
                          className={`${active ? 'bg-blue-600 text-white' : 'text-gray-900'
                            } group flex w-full items-center rounded-md px-2 py-2 text-sm`}
                        >
                          Usuários
                        </Link>
                      )}
                    </Menu.Item>
                  )}
                </div>
              </Menu.Items>
            </Transition>
          </Menu>

          {/* MENU VISUALIZAÇÃO */}
          <Menu as="div" className="relative inline-block text-left">
            <div>
              <Menu.Button className="flex items-center text-gray-700 hover:text-blue-600 font-medium px-3 py-2 rounded-md hover:bg-gray-50 transition-colors">
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
              <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div className="px-1 py-1">
                  <Menu.Item>
                    {({ active }) => (
                      <Link
                        to="/dashboard"
                        className={`${active ? 'bg-blue-600 text-white' : 'text-gray-900'
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

          <div className="h-6 w-px bg-gray-300 mx-2"></div>

          <button
            onClick={logout}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors shadow-sm"
          >
            Sair
          </button>
        </div>
      </div>
    </nav>
  );
}

function AppContent() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">

      {!isLoginPage && <Navbar />}

      <main className={`w-[95%] mx-auto flex-grow ${isLoginPage ? '' : 'py-8'}`}>
        <div className={`${isLoginPage ? 'max-w-md mx-auto' : 'bg-white shadow-lg rounded-lg border border-gray-200 p-6 md:p-8 min-h-[85vh]'}`}>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<PrivateRoute />}>
              <Route path="/" element={<WelcomePage />} />
              <Route path="/projects" element={<ProjectsListPage />} />
              <Route path="/project/:projectId/demandas" element={<DemandasListPage />} />
              <Route path="/demanda/:demandaId/scenarios" element={<ScenariosListPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/tags" element={<ManageTagsPage />} />
            </Route>

            <Route element={<PrivateRoute requiredRole="admin" />}>
              <Route path="/users" element={<UsersManager />} />
            </Route>

          </Routes>
        </div>
      </main>

      {!isLoginPage && (
        <footer className="w-full text-center p-4">
          <p className="text-xs text-gray-400">
            TestFlow v1.0
          </p>
        </footer>
      )}

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
      <AppContent />
    </AuthProvider>
  );
}

export default App;