import Link from "next/link";
import { daysAgo } from "@/lib/date";
import type { Contact } from "@/lib/types";
import { Tag } from "@/components/Tag";

interface ContactCardProps {
  contact: Contact;
  onDone: (contact: Contact) => void;
  isHighlighted?: boolean;
}

function getLatestNote(contact: Contact): string {
  if (contact.notes.length === 0) {
    return "No notes yet.";
  }

  const latest = [...contact.notes].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  )[0];

  return latest.text;
}

export function ContactCard({ contact, onDone, isHighlighted = false }: ContactCardProps) {
  const lastContactedDays = daysAgo(contact.lastContacted);

  return (
    <article
      className={`rounded-2xl border bg-white p-4 shadow-sm ${
        isHighlighted ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900/10" : "border-slate-200"
      }`}
      id={`contact-card-${contact.id}`}
      tabIndex={-1}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link className="rounded-md px-1 py-0.5 text-base font-semibold text-slate-900 hover:bg-slate-100 hover:underline" href={`/contact/${contact.id}`}>
            {contact.name}
          </Link>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Tag label={contact.type} />
            <Tag label={contact.location.replace("_", " ")} />
            <Tag label={contact.temperature} />
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-700">{getLatestNote(contact)}</p>
      <p className="mt-2 text-xs text-slate-500">Last contacted {lastContactedDays} day{lastContactedDays === 1 ? "" : "s"} ago</p>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {contact.phone ? (
          <a className="rounded-lg border border-slate-300 px-2 py-1.5 text-center text-sm text-slate-700 shadow-sm hover:-translate-y-px hover:bg-slate-50" href={`tel:${contact.phone}`}>
            Call
          </a>
        ) : (
          <button className="cursor-not-allowed rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-400" disabled type="button">
            Call
          </button>
        )}

        {contact.phone ? (
          <a className="rounded-lg border border-slate-300 px-2 py-1.5 text-center text-sm text-slate-700 shadow-sm hover:-translate-y-px hover:bg-slate-50" href={`sms:${contact.phone}`}>
            Text
          </a>
        ) : (
          <button className="cursor-not-allowed rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-400" disabled type="button">
            Text
          </button>
        )}

        {contact.social ? (
          <a
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-center text-sm text-slate-700 shadow-sm hover:-translate-y-px hover:bg-slate-50"
            href={contact.social}
            rel="noreferrer"
            target="_blank"
          >
            DM
          </a>
        ) : (
          <button className="cursor-not-allowed rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-400" disabled type="button">
            DM
          </button>
        )}

        <button
          className="rounded-lg bg-slate-900 px-2 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          onClick={() => onDone(contact)}
          type="button"
        >
          Done
        </button>
      </div>
    </article>
  );
}
