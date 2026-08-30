import { Button } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

export function NewNovelButton() {
  return (
    <Button
      variant="default"
      size="compact-md"
      classNames={{ root: "h-7", label: "gap-1 text-sm font-medium" }}
      renderRoot={(props) => (
        <Link to="." search={(prev) => ({ ...prev, modal: "create-novel" as const })} {...props} />
      )}
    >
      <Plus className="size-4" />
      New Novel
    </Button>
  );
}
