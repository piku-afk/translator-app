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
  SourceLanguageSchema,
  TotalChaptersSchema,
  type SourceLanguage,
} from "#/lib/novels/novels-core";
import { getErrorMessage } from "#/lib/utils";

const SOURCE_LANGUAGE_OPTIONS = [
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
];

const FormSchema = z.object({
  name: NovelNameSchema,
  totalChapters: TotalChaptersSchema,
  sourceLanguage: SourceLanguageSchema,
  rawFile: z.instanceof(File, { message: "Raw text file is required" }),
});

interface NewNovelFormValues {
  name: string;
  totalChapters: number | undefined;
  sourceLanguage: SourceLanguage | "";
  rawFile: File | null;
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
        totalChapters: undefined,
        sourceLanguage: "",
        rawFile: null,
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
              const totalChapters = values.totalChapters ?? 0;
              void values.rawFile?.text().then((rawText) => {
                createNovelMutation.mutate({
                  data: {
                    name: values.name,
                    totalChapters,
                    sourceLanguage: values.sourceLanguage as SourceLanguage,
                    rawText,
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
                key={form.key("totalChapters")}
                {...form.getInputProps("totalChapters")}
              />

              <Select
                label="Source language"
                placeholder="Select the language of the raw text"
                data={SOURCE_LANGUAGE_OPTIONS}
                allowDeselect={false}
                classNames={{ label: "mb-2" }}
                key={form.key("sourceLanguage")}
                {...form.getInputProps("sourceLanguage")}
              />

              <FileInput
                label="Raw text file"
                placeholder="Upload the source text (.txt)"
                accept=".txt,text/plain"
                clearable
                classNames={{ label: "mb-2" }}
                key={form.key("rawFile")}
                {...form.getInputProps("rawFile")}
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
