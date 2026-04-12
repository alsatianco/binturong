import { useCallback, useRef, useState } from "react";

export type CancelableTaskProgress = {
  percent: number;
  message: string;
};

export type CancelableTaskContext = {
  signal: AbortSignal;
  reportProgress: (progress: CancelableTaskProgress) => void;
};

type UseCancelableProgressTaskOptions<TInput, TResult> = {
  task: (input: TInput, context: CancelableTaskContext) => Promise<TResult>;
};

export function useCancelableProgressTask<TInput, TResult>({
  task,
}: UseCancelableProgressTaskOptions<TInput, TResult>) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<CancelableTaskProgress>({
    percent: 0,
    message: "Idle",
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
    setProgress({ percent: 0, message: "Canceled" });
  }, []);

  const run = useCallback(
    async (input: TInput): Promise<TResult> => {
      abortControllerRef.current?.abort();

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsRunning(true);
      setErrorMessage(null);
      setProgress({ percent: 0, message: "Starting..." });

      try {
        const result = await task(input, {
          signal: controller.signal,
          reportProgress: (nextProgress) => {
            if (!controller.signal.aborted) {
              setProgress(nextProgress);
            }
          },
        });

        if (controller.signal.aborted) {
          throw new Error("Task canceled");
        }

        setProgress({ percent: 100, message: "Done" });
        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Task execution failed";
        setErrorMessage(message);
        throw error;
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
          setIsRunning(false);
        }
      }
    },
    [task],
  );

  return {
    run,
    cancel,
    isRunning,
    progress,
    errorMessage,
  };
}
