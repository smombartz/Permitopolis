import { AppShell } from "@/components/shell/AppShell";

export default function Layout({ children }: LayoutProps<"/events">) {
  return <AppShell>{children}</AppShell>;
}
