import type { Metadata } from "next";

import { PageBar } from "@/components/TopBar";

import { SearchClient } from "./SearchClient";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <main>
      <PageBar title="Search" backHref="/" />
      <div className="px-4.5 pt-[86px] pb-28">
        <SearchClient />
      </div>
    </main>
  );
}
