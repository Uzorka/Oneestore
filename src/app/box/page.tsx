import type { Metadata } from "next";

import { ACTION_BAR_CLEARANCE, Container } from "@/components/Container";
import { PageBar } from "@/components/TopBar";
import { BoxClient } from "./BoxClient";

export const metadata: Metadata = {
  title: "Build Your Box",
  description: "Mix whatever you like. The more the box holds, the less you pay per kilogram.",
};

export default function BoxPage() {
  return (
    <main>
      <PageBar title="Build Your Box" backHref="/" />

      <Container className={`flex flex-col gap-6 pt-[92px] md:pt-[112px] ${ACTION_BAR_CLEARANCE}`}>
        <header className="flex flex-col gap-1.5">
          <h1 className="font-display text-[26px] leading-tight font-semibold md:text-[36px]">
            Build Your Box
          </h1>
          <p className="max-w-prose text-[13px] leading-relaxed text-ink-soft md:text-[15px]">
            Mix whatever you like. The more it holds, the less you pay per kilo — and the rate follows
            the box into your basket.
          </p>
        </header>

        <BoxClient />
      </Container>
    </main>
  );
}
