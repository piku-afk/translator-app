import {
  Alert,
  Button,
  CloseButton,
  Group,
  Input,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { schemaResolver, useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Upload, X } from "lucide-react";
import { z } from "zod";
import { createNovel, novelsQueryKey, recentActivitiesQueryKey } from "#/lib/novels/novels";
import {
  NovelNameSchema,
  SOURCE_LANGUAGE_OPTIONS,
  SourceLanguageSchema,
  TotalChaptersSchema,
  type SourceLanguage,
} from "#/lib/novels/novels-core";
import { getErrorMessage } from "#/lib/utils";

export const CREATE_NOVEL_MODAL = "create-novel";

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
        color: "green",
      });
      await queryClient.invalidateQueries({ queryKey: novelsQueryKey });
      await queryClient.invalidateQueries({ queryKey: recentActivitiesQueryKey });
    },
  });

  const isPending = createNovelMutation.isPending;

  const form = useForm<NewNovelFormValues>({
    mode: "uncontrolled",
    initialValues: {
      name: "",
      total_chapters: undefined,
      source_language: "",
      raw_text: null,
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

          <Input.Wrapper
            label="Raw text file"
            error={form.errors.raw_text}
            classNames={{ label: "mb-2", error: "mt-1.25" }}
          >
            <Dropzone
              multiple={false}
              accept={["text/plain"]}
              p={form.values.raw_text ? "sm" : "lg"}
              disabled={isPending}
              enablePointerEvents
              onDrop={(files) => {
                form.setFieldValue("raw_text", files[0] ?? null);
                form.validateField("raw_text");
              }}
              onReject={() => form.setFieldError("raw_text", "Only .txt files are accepted")}
            >
              {form.values.raw_text ? (
                <Group justify="space-between" wrap="nowrap" gap="sm">
                  <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                    <Check size={16} style={{ flexShrink: 0 }} aria-hidden />
                    <Text size="sm" truncate style={{ minWidth: 0 }}>
                      {form.values.raw_text.name}
                    </Text>
                  </Group>
                  <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
                    <Text size="sm" c="dimmed" visibleFrom="sm">
                      {formatFileSize(form.values.raw_text.size)}
                    </Text>
                    <CloseButton
                      size="sm"
                      aria-label={`Remove ${form.values.raw_text.name}`}
                      disabled={isPending}
                      onClick={(event) => {
                        event.stopPropagation();
                        form.setFieldValue("raw_text", null);
                        form.clearFieldError("raw_text");
                      }}
                    />
                  </Group>
                </Group>
              ) : (
                <Stack align="center" gap="xs">
                  <Dropzone.Accept>
                    <Upload size={24} aria-hidden />
                  </Dropzone.Accept>
                  <Dropzone.Reject>
                    <X size={24} aria-hidden />
                  </Dropzone.Reject>
                  <Dropzone.Idle>
                    <Upload size={24} aria-hidden />
                  </Dropzone.Idle>
                  <Text size="sm" c="dimmed">
                    Drag your .txt file here or click to browse
                  </Text>
                </Stack>
              )}
            </Dropzone>
          </Input.Wrapper>

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
