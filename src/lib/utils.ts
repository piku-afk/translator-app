import { clsx, type ClassValue } from "clsx";
import { format, formatDistanceToNow, startOfDay, subDays } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

type ErrorWithMessage = {
  message: string;
};

export function formatDateTime(iso: string) {
  return format(iso, "do MMM yyyy");
}

export function formatRelativeDateTime(iso: string): string {
  const date = new Date(iso);
  const cutoff = startOfDay(subDays(new Date(), 1)); // start of yesterday
  return date >= cutoff ? formatDistanceToNow(date, { addSuffix: true }) : formatDateTime(iso);
}

function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  );
}

function toErrorWithMessage(maybeError: unknown): ErrorWithMessage {
  if (isErrorWithMessage(maybeError)) return maybeError;

  try {
    return new Error(JSON.stringify(maybeError));
  } catch {
    // fallback in case there's an error stringify-ing the maybeError
    // like with circular references for example.
    return new Error(String(maybeError));
  }
}

export function getErrorMessage(error: unknown): string {
  return toErrorWithMessage(error).message;
}
