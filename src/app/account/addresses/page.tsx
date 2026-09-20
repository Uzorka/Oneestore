import type { Metadata } from "next";

import { Container, BOTTOM_CLEARANCE } from "@/components/Container";
import { PageBar } from "@/components/TopBar";

import { AccountShell, AddressBook } from "../AccountClient";

export const metadata: Metadata = { title: "Addresses" };

export default function AddressesPage() {
  return (
    <main>
      <PageBar title="Addresses" backHref="/account" />
      <Container className={`pt-[92px] md:pt-[106px] ${BOTTOM_CLEARANCE}`}>
        <AccountShell title="Addresses">
          <AddressBook />
        </AccountShell>
      </Container>
    </main>
  );
}
