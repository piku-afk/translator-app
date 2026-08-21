import { getErrorMessage } from "#/lib/utils";
import { Button } from "./ui/button";

export function ErrorFallback({
  componentName,
  error,
  onRetry,
}: {
  componentName: string;
  error: unknown;
  onRetry?: () => void | Promise<void>;
}) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="w-full py-6 rounded-lg border border-destructive flex flex-col gap-1 items-center text-center"
    >
      <h3 className="text-lg">Failed to load {componentName}</h3>
      <p className="text-sm text-muted-foreground">{getErrorMessage(error)}</p>

      {onRetry ? (
        <Button variant="destructive" className="mt-4" onClick={onRetry}>
          Try Again
        </Button>
      ) : null}
    </div>
  );
}
