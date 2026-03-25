export type ContactKind =
  | "buyer"
  | "seller"
  | "investor"
  | "renter"
  | "lender"
  | "inspector"
  | "agent"
  | "other";
export type LocationKind = string;
export type TemperatureKind = "cold" | "warm" | "hot";
export type TierKind = "A" | "B" | "C" | "D";

export interface ContactNote {
  text: string;
  date: Date;
}

export interface Contact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  social?: string;
  type: ContactKind;
  location: LocationKind;
  temperature: TemperatureKind;
  tier: TierKind;
  nextFollowUp: Date;
  lastContacted: Date;
  notes: ContactNote[];
}

export type NewContactInput = Omit<Contact, "id">;
