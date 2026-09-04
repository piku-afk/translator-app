import {
  Alert,
  Button,
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
};

const FormSchema = z.object({
  name: NovelNameSchema,
  total_chapters: TotalChaptersSchema,
  source_language: SourceLanguageSchema,
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
        color: "green",
      });
      await queryClient.invalidateQueries({ queryKey: novelsQueryKey });
    },
  });

  const isPending = createNovelMutation.isPending;

  const form = useForm<NewNovelFormValues>({
    mode: "uncontrolled",
    initialValues: {
      name: "",
      total_chapters: undefined,
      source_language: "",
    },
    validate: schemaResolver(FormSchema),
    enhanceGetInputProps: () => ({ disabled: isPending }),
  });

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
          createNovelMutation.mutate({
            data: {
              name: values.name,
              total_chapters: values.total_chapters ?? 0,
              source_language: values.source_language as SourceLanguage,
            },
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

          <Group className="mt-2 justify-end">
            <Button variant="default" disabled={isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button variant="default" type="submit" loading={isPending}>
              Create novel
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
