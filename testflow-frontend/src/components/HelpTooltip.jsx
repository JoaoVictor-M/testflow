import { useEffect, useId, useRef, useState } from 'react';

function HelpTooltip({ label, children, align = 'right' }) {
    const tooltipId = useId();
    const containerRef = useRef(null);
    const ignoreNextFocusRef = useRef(false);
    const [hoverOpen, setHoverOpen] = useState(false);
    const [focusOpen, setFocusOpen] = useState(false);
    const [pinnedOpen, setPinnedOpen] = useState(false);

    const isOpen = hoverOpen || focusOpen || pinnedOpen;

    useEffect(() => {
        if (!isOpen) return undefined;
        const handleOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setHoverOpen(false);
                setFocusOpen(false);
                setPinnedOpen(false);
            }
        };
        document.addEventListener('pointerdown', handleOutside);
        return () => document.removeEventListener('pointerdown', handleOutside);
    }, [isOpen]);

    const closeAll = () => {
        setHoverOpen(false);
        setFocusOpen(false);
        setPinnedOpen(false);
    };

    const handlePointerDown = () => {
        ignoreNextFocusRef.current = true;
    };

    const handleFocus = () => {
        if (ignoreNextFocusRef.current) {
            ignoreNextFocusRef.current = false;
            return;
        }
        setFocusOpen(true);
    };

    const handleBlur = (event) => {
        if (!containerRef.current?.contains(event.relatedTarget)) {
            closeAll();
        }
    };

    const handleClick = () => {
        ignoreNextFocusRef.current = false;
        if (pinnedOpen || focusOpen) {
            closeAll();
            return;
        }
        setPinnedOpen(true);
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Escape' && isOpen) {
            event.stopPropagation();
            closeAll();
        }
    };

    const positionClass = align === 'left' ? 'left-0' : 'right-0';

    return (
        <div
            ref={containerRef}
            className="relative inline-flex items-center"
            onMouseEnter={() => setHoverOpen(true)}
            onMouseLeave={() => setHoverOpen(false)}
            onBlur={handleBlur}
        >
            <button
                type="button"
                aria-label={label}
                aria-expanded={isOpen}
                aria-controls={tooltipId}
                aria-describedby={isOpen ? tooltipId : undefined}
                onPointerDown={handlePointerDown}
                onFocus={handleFocus}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                className="inline-flex items-center justify-center rounded-full p-1 text-gray-400 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </button>

            {isOpen && (
                <div
                    id={tooltipId}
                    role="tooltip"
                    className={`absolute ${positionClass} bottom-full mb-2 w-72 max-w-[calc(100vw-3rem)] p-4 bg-gray-900 dark:bg-neutral-900 text-white text-xs rounded-lg shadow-xl z-50 border border-gray-700 dark:border-neutral-700 text-left`}
                >
                    {children}
                </div>
            )}
        </div>
    );
}

export default HelpTooltip;
