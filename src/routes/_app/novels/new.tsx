import {
  Alert,
  FileInput,
  NumberInput,
  Select,
  Stack,
  Text,
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

type NewNovelFormValues = {
  name: string;
  total_chapters: number | undefined;
  source_language: SourceLanguage | "";
  raw_text: File | null;
};

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
      <Stack className="mx-auto w-full max-w-sm gap-6">
        <Stack className="gap-1">
          <Title order={2}>New Novel</Title>
          <Text c="dimmed" className="text-sm">
            Create a novel to start translating its chapters into English.
          </Text>
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
          <Stack className="gap-6">
            <TextInput
              label="Novel name"
              classNames={{ label: "mb-2" }}
              placeholder="e.g. The Beginning"
              key={form.key("name")}
              {...form.getInputProps("name")}
            />

            <Select
              allowDeselect={false}
              label="Source language"
              classNames={{ label: "mb-2" }}
              placeholder="Select the language of the raw text"
              data={SOURCE_LANGUAGE_OPTIONS}
              key={form.key("source_language")}
              {...form.getInputProps("source_language")}
            />

            <NumberInput
              min={1}
              hideControls
              allowNegative={false}
              placeholder="e.g. 120"
              label="Total chapters"
              classNames={{ label: "mb-2" }}
              key={form.key("total_chapters")}
              {...form.getInputProps("total_chapters")}
            />

            <FileInput
              clearable
              label="Raw text file"
              accept=".txt,text/plain"
              classNames={{ label: "mb-2" }}
              placeholder="Upload the source text (.txt)"
              key={form.key("raw_text")}
              {...form.getInputProps("raw_text")}
            />

            <Button
              type="submit"
              className="mt-2"
              loadingText="Creating"
              loading={createNovelMutation.isPending}
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
    );
  },
});
