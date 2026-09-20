import type { Metadata } from "next";

import { BOTTOM_CLEARANCE, Container } from "@/components/Container";
import { PageBar } from "@/components/TopBar";

import { SearchClient } from "./SearchClient";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <main>
      <PageBar title="Search" backHref="/" />
      <Container className={`max-w-[760px] pt-[92px] md:pt-[112px] ${BOTTOM_CLEARANCE}`}>
        <SearchClient />
      </Container>
    </main>
  );
}
