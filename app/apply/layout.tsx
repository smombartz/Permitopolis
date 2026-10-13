import { AppShell } from "@/components/shell/AppShell";

export default function Layout({ children }: LayoutProps<"/apply">) {
  return <AppShell>{children}</AppShell>;
}
