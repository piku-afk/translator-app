import {
  Alert,
  Container,
  FileInput,
  NumberInput,
  Select,
  Stack,
  TextInput,
  Title,
} from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "#/components/ui/button";
import { createNovel, novelsQueryKey } from "#/lib/novels/novels";
import {
  NovelNameSchema,
  SOURCE_LANGUAGE_OPTIONS,
  SourceLanguageSchema,
  TotalChaptersSchema,
  type SourceLanguage,
} from "#/lib/novels/novels-core";
import { getErrorMessage } from "#/lib/utils";

const FormSchema = z.object({
  name: NovelNameSchema,
  total_chapters: TotalChaptersSchema,
  source_language: SourceLanguageSchema,
  raw_text: z.instanceof(File, { message: "Raw text file is required" }),
});

interface NewNovelFormValues {
  name: string;
  total_chapters: number | undefined;
  source_language: SourceLanguage | "";
  raw_text: File | null;
}

export const Route = createFileRoute("/_app/novels/new")({
  component: function NewNovelPage() {
    const navigate = Route.useNavigate();
    const queryClient = useQueryClient();

    const createNovelMutation = useMutation({
      mutationFn: createNovel,
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: novelsQueryKey });
        await navigate({ to: "/" });
      },
    });

    const form = useForm<NewNovelFormValues>({
      mode: "uncontrolled",
      initialValues: {
        name: "",
        total_chapters: undefined,
        source_language: "",
        raw_text: null,
      },
      validate: schemaResolver(FormSchema),
    });

    return (
      <Container component="main" className="py-10">
        <Stack className="mx-auto w-full max-w-lg gap-6">
          <Stack className="gap-1">
            <Title order={2}>New Novel</Title>
            <p className="text-sm text-muted-foreground">
              Create a novel to start translating its chapters into English.
            </p>
          </Stack>

          <form
            onSubmit={form.onSubmit((values) => {
              const total_chapters = values.total_chapters ?? 0;
              void values.raw_text?.text().then((raw_text) => {
                createNovelMutation.mutate({
                  data: {
                    name: values.name,
                    total_chapters,
                    source_language: values.source_language as SourceLanguage,
                    raw_text,
                  },
                });
              });
            })}
          >
            <Stack className="gap-4">
              <TextInput
                label="Novel name"
                placeholder="e.g. The Beginning"
                classNames={{ label: "mb-2" }}
                key={form.key("name")}
                {...form.getInputProps("name")}
              />

              <NumberInput
                label="Total chapters"
                placeholder="e.g. 120"
                min={1}
                allowNegative={false}
                classNames={{ label: "mb-2" }}
                key={form.key("total_chapters")}
                {...form.getInputProps("total_chapters")}
              />

              <Select
                label="Source language"
                placeholder="Select the language of the raw text"
                data={SOURCE_LANGUAGE_OPTIONS}
                allowDeselect={false}
                classNames={{ label: "mb-2" }}
                key={form.key("source_language")}
                {...form.getInputProps("source_language")}
              />

              <FileInput
                label="Raw text file"
                placeholder="Upload the source text (.txt)"
                accept=".txt,text/plain"
                clearable
                classNames={{ label: "mb-2" }}
                key={form.key("raw_text")}
                {...form.getInputProps("raw_text")}
              />

              <Button
                type="submit"
                loading={createNovelMutation.isPending}
                loadingText="Creating…"
                className="mt-2"
              >
                Create novel
              </Button>
            </Stack>
          </form>

          {createNovelMutation.error && (
            <Alert variant="light" color="red" title="Could not create novel">
              {getErrorMessage(createNovelMutation.error)}
            </Alert>
          )}
        </Stack>
      </Container>
    );
  },
});
