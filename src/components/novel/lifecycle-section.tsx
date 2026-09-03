import { Skeleton, Stack } from "@mantine/core";
import { SectionHeading } from "#/components/ui/section-heading";
import { LifecycleStepper } from "./lifecycle-stepper";

export function LifecycleSectionSkeleton() {
  return (
    <Stack className="gap-3">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </Stack>
  );
}

export function LifecycleSection({ slug }: { slug: string }) {
  // const isActive = isParsing || isExtracting || isTranslating;

  // const { data: chapters } = useSuspenseQuery({
  //   ...getChaptersQueryOptions(slug),
  //   // Live stepper progress while a job runs (translated count / names-
  //   // extracted count feed the active step's progress bar).
  // refetchInterval: isActive ? 3000 : false,
  // });
  // const { data: glossary } = useSuspenseQuery(getGlossaryQueryOptions(slug));

  // const chapterStatuses = chapters ?? [];
  // const namesExtractedChapterCount = chapterStatuses.filter(
  //   (chapter) => chapter.status === "names extracted",
  // ).length;
  // const translatedChapterCount = chapterStatuses.filter(
  //   (chapter) => chapter.status === "translated",
  // ).length;

  return (
    <Stack className="gap-6">
      <SectionHeading>Lifecycle</SectionHeading>

      <LifecycleStepper slug={slug} />
    </Stack>
  );
}
