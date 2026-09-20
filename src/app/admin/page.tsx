import type { Metadata } from "next";

import { AdminShell } from "./AdminShell";
import { TodayClient } from "./TodayClient";

export const metadata: Metadata = { title: "Today · Operations" };

export default function AdminPage() {
  return (
    <AdminShell title="Today" subtitle="What is blocking, what is running out, what is waiting.">
      <TodayClient />
    </AdminShell>
  );
}
