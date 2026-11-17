import fs from "fs";
import path from "path";
import type { Card } from "@/lib/types";
import { isScoutCard } from "@/lib/identity";

export type Receipt =
  | { kind: "email"; text: string }
  | { kind: "url"; href: string; label: string }
  | { kind: "text"; text: string };

function emails(): Array<{ file: string; raw: string; subject: string }> {
  const dir = path.join(process.cwd(), "emails");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => /\.(eml|txt|html)$/i.test(file))
    .slice(0, 40)
    .map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const subject = raw.match(/^Subject:\s*(.+)$/im)?.[1]?.trim() ?? "";
      return { file, raw, subject };
    });
}

function emailFor(card: Card): string | null {
  const subjectHint = card.source.match(/subject:\s*(.+)$/i)?.[1]?.trim().toLowerCase();
  const title = card.title.toLowerCase();
  for (const email of emails()) {
    const subject = email.subject.toLowerCase();
    const named =
      card.source.toLowerCase().includes(email.file.toLowerCase()) ||
      (subjectHint != null && subjectHint.length > 0 && subject.includes(subjectHint.slice(0, 48))) ||
      (subject.length > 0 && (subject.includes(title) || title.includes(subject.slice(0, 24))));
    if (!named) continue;
    const body = email.raw.split(/\r?\n\r?\n/).slice(1).join("\n\n").trim() || email.raw.trim();
    const text = `Subject: ${email.subject || email.file}\n\n${body}`.slice(0, 12000);
    return text;
  }
  return null;
}

function hrefFor(card: Card): string | null {
  if ((card.type === "event" || card.type === "opp") && card.link) return card.link;
  if (card.type === "pulse") {
    const cited = card.citations.find((item) => /^https?:\/\//i.test(item));
    if (cited) return cited;
  }
  const explicit = card.source.match(/https?:\/\/\S+/i)?.[0];
  if (explicit) return explicit.replace(/[),.]+$/, "");
  const domain = card.source.match(/\b([a-z0-9.-]+\.(?:edu|com|org))\b/i)?.[1];
  return domain ? `https://${domain}` : null;
}

export function receiptFor(card: Card): Receipt {
  if (isScoutCard(card)) {
    return { kind: "email", text: emailFor(card) ?? card.source };
  }
  const href = hrefFor(card);
  if (href) return { kind: "url", href, label: card.source };
  return { kind: "text", text: card.source };
}
