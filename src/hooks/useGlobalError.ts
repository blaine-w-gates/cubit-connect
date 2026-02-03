import { useEffect, useState } from 'react';

export const useGlobalError = () => {
  const [, setError] = useState();

  useEffect(() => {
    const handleAsyncError = (event: PromiseRejectionEvent) => {
      console.warn('Global Async Error Caught:', event.reason);
      setError(() => {
        throw event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      });
    };
    window.addEventListener('unhandledrejection', handleAsyncError);
    return () => {
      window.removeEventListener('unhandledrejection', handleAsyncError);
    };
  }, []);
};
