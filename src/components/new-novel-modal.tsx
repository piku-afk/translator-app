import {
  Alert,
  FileInput,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

export const CREATE_NOVEL_MODAL = "create-novel";

type NewNovelFormValues = {
  name: string;
  total_chapters: number | undefined;
  source_language: SourceLanguage | "";
  raw_text: File | null;
};

const FormSchema = z.object({
  name: NovelNameSchema,
  total_chapters: TotalChaptersSchema,
  source_language: SourceLanguageSchema,
  raw_text: z.instanceof(File, { message: "Raw text file is required" }),
});

export function NewNovelModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();

  const createNovelMutation = useMutation({
    mutationFn: createNovel,
    onSuccess: async (data) => {
      onClose();
      notifications.show({
        title: "Novel created",
        message: `"${data.name}" is ready`,
        position: "top-center",
      });
      await queryClient.invalidateQueries({ queryKey: novelsQueryKey });
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

  const isPending = createNovelMutation.isPending;

  return (
    <Modal
      opened
      onClose={onClose}
      size="lg"
      centered
      title="New Novel"
      withCloseButton={false}
      closeOnClickOutside={!isPending}
      closeOnEscape={!isPending}
      closeButtonProps={{ disabled: isPending }}
      classNames={{ title: "text-xl font-medium", header: "pb-0" }}
    >
      <Text c="dimmed" className="text-sm">
        Create a novel to start translating its chapters into English.
      </Text>

      {createNovelMutation.error && (
        <Alert variant="light" color="red" title="Could not create novel" className="mt-6">
          {getErrorMessage(createNovelMutation.error)}
        </Alert>
      )}

      <form
        className="mt-6"
        onSubmit={form.onSubmit((values) => {
          void values.raw_text?.text().then((raw_text) => {
            createNovelMutation.mutate({
              data: {
                raw_text,
                name: values.name,
                total_chapters: values.total_chapters ?? 0,
                source_language: values.source_language as SourceLanguage,
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

          <SimpleGrid cols={{ base: 1, sm: 2 }} className="gap-6">
            <Select
              allowDeselect={false}
              label="Source language"
              checkIconPosition="right"
              classNames={{ label: "mb-2" }}
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
          </SimpleGrid>

          <FileInput
            clearable
            label="Raw text file"
            accept=".txt,text/plain"
            classNames={{ label: "mb-1" }}
            placeholder="Upload the source text (.txt)"
            key={form.key("raw_text")}
            {...form.getInputProps("raw_text")}
          />

          <Group className="mt-2 justify-end">
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" loadingText="Creating" loading={isPending}>
              Create novel
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
