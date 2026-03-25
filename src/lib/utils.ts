import { addDays } from "@/lib/date";
import type { Contact } from "@/lib/types";

type FollowUpContact = Pick<Contact, "name" | "type" | "temperature">;

export function getDefaultFollowUp(contact: FollowUpContact): Date {
  const name = contact.name.toUpperCase();

  if (name.includes("FSBO")) {
    return addDays(new Date(), 3);
  }

  if (contact.type === "investor") {
    return addDays(new Date(), 14);
  }

  if (contact.temperature === "hot") {
    return addDays(new Date(), 1);
  }

  if (contact.temperature === "warm") {
    return addDays(new Date(), 3);
  }

  return addDays(new Date(), 7);
}
