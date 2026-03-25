"use client";

import dynamic from "next/dynamic";

const ContactsClient = dynamic(
  () => import("@/components/ContactsClient"),
  { ssr: false }
);

export default function Page() {
  return <ContactsClient />;
}
