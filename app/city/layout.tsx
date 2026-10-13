import { CityShell } from "@/components/shell/CityShell";

export default function Layout({ children }: LayoutProps<"/city">) {
  return <CityShell>{children}</CityShell>;
}
