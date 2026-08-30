import { Title, type TitleProps } from "@mantine/core";
import { cn } from "#/lib/utils";

export interface SectionHeadingProps extends TitleProps {
  children: React.ReactNode;
}

/** Section heading used to label a group of content on a page. */
export function SectionHeading({ children, className, ...props }: SectionHeadingProps) {
  return (
    <Title order={2} className={cn("text-xl font-medium", className)} {...props}>
      {children}
    </Title>
  );
}
