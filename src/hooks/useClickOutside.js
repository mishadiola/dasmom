import { useEffect } from 'react';

/**
 * Hook that alerts clicks outside of the passed ref.
 * Also triggers on the Escape key.
 */
const useClickOutside = (ref, handler) => {
    useEffect(() => {
        const listener = (event) => {
            // Do nothing if clicking ref's element or descendant elements
            if (!ref.current || ref.current.contains(event.target)) {
                return;
            }
            handler(event);
        };

        const keyListener = (event) => {
            if (event.key === 'Escape') {
                handler(event);
            }
        };

        document.addEventListener('mousedown', listener);
        document.addEventListener('touchstart', listener);
        document.addEventListener('keydown', keyListener);

        return () => {
            document.removeEventListener('mousedown', listener);
            document.removeEventListener('touchstart', listener);
            document.removeEventListener('keydown', keyListener);
        };
    }, [ref, handler]);
};

export default useClickOutside;
