import { createContext, useState, useEffect } from 'react';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    // Inicializa o tema verificando localStorage ou preferência do sistema
    const [theme, setTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme) {
                return savedTheme;
            }
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                return 'dark';
            }
        }
        return 'light';
    });

    useEffect(() => {
        const root = window.document.documentElement;

        // Remove classes antigas para evitar conflitos
        root.classList.remove('light', 'dark');

        if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.classList.add(systemTheme);
            localStorage.removeItem('theme'); // Limpa preferência manual se for system
        } else {
            root.classList.add(theme);
            localStorage.setItem('theme', theme);
        }
    }, [theme]);

    // Listener para mudanças no sistema operacional quando em modo 'system' (ou sem preferência)
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            if (theme === 'system' || !localStorage.getItem('theme')) {
                const root = window.document.documentElement;
                root.classList.remove('light', 'dark');
                root.classList.add(mediaQuery.matches ? 'dark' : 'light');
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
