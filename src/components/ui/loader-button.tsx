import { Button, type ButtonProps } from "@mantine/core";
import { Loader } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";

export function LoaderButton({
  loading,
  disabled,
  leftSection,
  ...restProps
}: ButtonProps & ComponentPropsWithoutRef<"button">) {
  return (
    <Button
      disabled={loading || disabled}
      leftSection={loading ? <Loader className="size-4 animate-spin" /> : leftSection}
      {...restProps}
    />
  );
}
