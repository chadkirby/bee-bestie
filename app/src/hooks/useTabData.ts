import { useRef, useEffect, useState, useCallback } from 'react';

export interface TabDataOptions<T> {
  /** Function to fetch data for a given puzzle date */
  fetchData: (puzzleDate: string, signal: AbortSignal) => Promise<T>;
  /** Optional initial data */
  initialData?: T | null;
}

export interface TabDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  fetchData: (puzzleDate: string) => Promise<void>;
  clearData: () => void;
}

/**
 * Reusable hook for managing tab-specific data with abortable requests
 * Prevents race conditions and cancels pending requests when navigating away
 */
export function useTabData<T>({
  fetchData,
  initialData = null,
}: TabDataOptions<T>): TabDataResult<T> {
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the current request to prevent race conditions
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearData = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  const executeFetch = useCallback(async (puzzleDate: string) => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);

    try {
      const result = await fetchData(puzzleDate, abortController.signal);

      // Check if request was aborted during fetch
      if (abortController.signal.aborted) {
        return;
      }

      setData(result);
    } catch (err) {
      // Don't show error for aborted requests
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      // Only update loading state if request wasn't aborted
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [fetchData]);

  // Cleanup: cancel any pending requests when component unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    fetchData: executeFetch,
    clearData,
  };
}

