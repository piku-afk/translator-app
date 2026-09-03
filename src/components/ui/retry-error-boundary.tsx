import { Alert, Button, Stack, Text, ThemeIcon } from "@mantine/core";
import { TriangleAlert } from "lucide-react";
import { getErrorMessage } from "#/lib/utils";
import { ErrorBoundary } from "react-error-boundary";
import type { PropsWithChildren } from "react";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";

const DEFAULT_ERROR_TITLE = "Something went wrong";

export function RetryErrorBoundary({
  title = DEFAULT_ERROR_TITLE,
  children,
}: PropsWithChildren<{ title?: string }>) {
  const { reset } = useQueryErrorResetBoundary();
  return (
    <ErrorBoundary
      onReset={reset}
      fallbackRender={({ error, resetErrorBoundary }) => (
        <Alert variant="light" color="red">
          <Stack className="gap-2 mb-1 items-center">
            <ThemeIcon color="red" variant="light" size="xl">
              <TriangleAlert className="size-10" />
            </ThemeIcon>

            <Text className="text-base font-medium">{title}</Text>

            <Text c="dimmed" className="text-sm">
              {getErrorMessage(error)}
            </Text>

            <Button
              size="xs"
              variant="outline"
              color="red"
              onClick={resetErrorBoundary}
              className="mt-4"
            >
              Try Again
            </Button>
          </Stack>
        </Alert>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
