import { Alert, Button, Container, PasswordInput, Stack, Text, Title } from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { getAuthState, login, LoginSchema } from "#/lib/auth/session";
import { getErrorMessage } from "#/lib/utils";

export const Route = createFileRoute("/login")({
  loader: async () => {
    const { authenticated } = await getAuthState();
    if (authenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: function LoginPage() {
    const navigate = Route.useNavigate();
    const loginMutation = useMutation({
      mutationFn: login,
      onSuccess: () => {
        navigate({ to: "/" });
      },
    });

    const form = useForm<LoginSchema>({
      mode: "uncontrolled",

      initialValues: { password: "" },
      validate: schemaResolver(LoginSchema),
    });

    return (
      <Container component="main" className="py-24">
        <Stack className="mx-auto w-full max-w-sm gap-6">
          <Stack className="items-center gap-1">
            <Title order={2}>Welcome back</Title>
            <Text c="dimmed" size="sm">
              Enter the shared password to continue
            </Text>
          </Stack>

          <form onSubmit={form.onSubmit((values) => loginMutation.mutate({ data: values }))}>
            <Stack className="gap-6">
              <PasswordInput
                autoFocus
                label="Password"
                autoCorrect="off"
                autoCapitalize="off"
                placeholder="Password"
                autoComplete="current-password"
                classNames={{ label: "mb-2" }}
                spellCheck={false}
                key={form.key("password")}
                {...form.getInputProps("password")}
              />

              <Button type="submit" variant="filled" loading={loginMutation.isPending}>
                Log in
              </Button>
            </Stack>
          </form>

          {loginMutation.error && (
            <Alert variant="light" color="red" title="Login Error">
              {getErrorMessage(loginMutation.error)}
            </Alert>
          )}
        </Stack>
      </Container>
    );
  },
});
