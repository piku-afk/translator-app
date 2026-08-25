import { Anchor, AppShell, Container, Group } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { CreditsBadge } from "./credits-badge";

export function Header() {
  return (
    <AppShell.Header>
      <Container strategy="grid" component="nav" className="h-full" px={{ base: "lg", md: 0 }}>
        <Group align="center" className="h-full justify-between">
          <Anchor
            c="dimmed"
            underline="never"
            className="text-xl font-medium"
            renderRoot={(props) => <Link to="/" {...props} />}
          >
            Translator
          </Anchor>

          <CreditsBadge />
        </Group>
      </Container>
    </AppShell.Header>
  );
}
