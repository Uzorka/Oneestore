import type { Metadata } from "next";

import { ACTION_BAR_CLEARANCE, Container } from "@/components/Container";
import { PageBar } from "@/components/TopBar";

import { BasketClient } from "./BasketClient";

export const metadata: Metadata = { title: "Basket" };

export default function BasketPage() {
  return (
    <main>
      <PageBar title="Your basket" backHref="/shop" />
      <Container className={`pt-[92px] md:pt-[112px] ${ACTION_BAR_CLEARANCE}`}>
        <BasketClient />
      </Container>
    </main>
  );
}
