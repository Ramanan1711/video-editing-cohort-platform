import { useCallback, useState } from 'react';
import type { UseMutationOptions, UseMutationResult } from './types';

export function useMutation<TData = unknown, TVariables = void>(
  options: UseMutationOptions<TData, TVariables>
): UseMutationResult<TData, TVariables> {
  const [data, setData] = useState<TData | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);

  const { mutationFn, onSuccess, onError, onSettled } = options;

  const mutateAsync = useCallback(
    async (variables: TVariables): Promise<TData> => {
      setIsPending(true);
      setError(null);
      setIsSuccess(false);
      setIsError(false);

      try {
        const result = await mutationFn(variables);
        setData(result);
        setIsSuccess(true);
        if (onSuccess) {
          await onSuccess(result, variables);
        }
        if (onSettled) {
          await onSettled(result, null, variables);
        }
        return result;
      } catch (err: unknown) {
        const parsedError = err instanceof Error ? err : new Error(String(err));
        setError(parsedError);
        setIsError(true);
        if (onError) {
          await onError(parsedError, variables);
        }
        if (onSettled) {
          await onSettled(undefined, parsedError, variables);
        }
        throw parsedError;
      } finally {
        setIsPending(false);
      }
    },
    [mutationFn, onSuccess, onError, onSettled]
  );

  const mutate = useCallback(
    (variables: TVariables) => {
      mutateAsync(variables).catch(() => {
        // Errors handled by onError and state
      });
    },
    [mutateAsync]
  );

  const reset = useCallback(() => {
    setData(undefined);
    setError(null);
    setIsPending(false);
    setIsSuccess(false);
    setIsError(false);
  }, []);

  return {
    mutate,
    mutateAsync,
    data,
    error,
    isPending,
    isSuccess,
    isError,
    reset,
  };
}
