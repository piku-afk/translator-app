import { Button } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

export function NewNovelButton() {
  return (
    <Button
      variant="outline"
      size="compact-md"
      classNames={{ root: "h-7 hover:text-black", label: "gap-1 text-sm font-medium" }}
      renderRoot={(props) => <Link to="/novels/new" {...props} />}
    >
      <Plus className="size-4" />
      New Novel
    </Button>
  );
}
