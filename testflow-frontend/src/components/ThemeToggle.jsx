import { useContext } from 'react';
import { Switch } from '@headlessui/react';
import { ThemeContext } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle = () => {
    const { theme, toggleTheme } = useContext(ThemeContext);
    // Considera 'dark' se estiver explicitamente setado ou se for system e o OS estiver dark
    // Mas para o switch visual, simplificamos: checked = dark
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    return (
        <Switch
            checked={isDark}
            onChange={toggleTheme}
            className={`${isDark ? 'bg-slate-700' : 'bg-blue-100'}
          relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus-visible:ring-2  focus-visible:ring-white focus-visible:ring-opacity-75`}
        >
            <span className="sr-only">Alternar Tema</span>
            <span
                aria-hidden="true"
                className={`${isDark ? 'translate-x-6 bg-slate-900' : 'translate-x-0 bg-white'}
            pointer-events-none inline-block h-7 w-7 transform rounded-full shadow-lg ring-0 transition duration-300 ease-in-out flex items-center justify-center`}
            >
                {isDark ? (
                    <Moon size={16} className="text-blue-200" />
                ) : (
                    <Sun size={16} className="text-yellow-500" />
                )}
            </span>
        </Switch>
    );
};

export default ThemeToggle;
