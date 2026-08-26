import { ActionIcon, Anchor, AppShell, Container, Group, Tooltip } from "@mantine/core";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { logout } from "#/lib/auth/session";
import { CreditsBadge } from "./credits-badge";
import { LogOut } from "lucide-react";

export function Header() {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      navigate({ to: "/login" });
    } catch {
      setSigningOut(false);
    }
  }

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

          <Group className="gap-4">
            <CreditsBadge />

            <Tooltip label="Log out">
              <ActionIcon
                size="md"
                variant="default"
                className="w-8 h-8 [&_svg]:size-4"
                loading={signingOut}
                onClick={handleSignOut}
              >
                <LogOut />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Container>
    </AppShell.Header>
  );
}
