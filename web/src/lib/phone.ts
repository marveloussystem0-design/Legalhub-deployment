export interface NormalizedPhone {
  raw: string;
  digits: string;
  national10: string | null;
  canonical: string;
  candidates: string[];
}

export function normalizePhone(input: string): NormalizedPhone {
  const raw = String(input || "").trim();
  const digits = raw.replace(/\D/g, "");

  // India-focused normalization:
  // supports 10-digit local, 91XXXXXXXXXX, 0XXXXXXXXXX, and formatted variants.
  let national10: string | null = null;
  if (digits.length === 10) {
    national10 = digits;
  } else if (digits.length === 11 && digits.startsWith("0")) {
    national10 = digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith("91")) {
    national10 = digits.slice(2);
  } else if (digits.length > 12) {
    national10 = digits.slice(-10);
  }

  const canonical = national10
    ? `+91${national10}`
    : digits
      ? `+${digits}`
      : raw;

  const candidatesSet = new Set<string>();
  const add = (v: string | null | undefined) => {
    if (!v) return;
    const t = v.trim();
    if (t) candidatesSet.add(t);
  };

  add(raw);
  add(digits);
  add(canonical);

  if (national10) {
    add(national10);
    add(`+91${national10}`);
    add(`91${national10}`);
    add(`0${national10}`);
    add(`+91 ${national10}`);
    add(`${national10.slice(0, 5)} ${national10.slice(5)}`);
    add(`${national10.slice(0, 5)}-${national10.slice(5)}`);
    add(`+91-${national10.slice(0, 5)}-${national10.slice(5)}`);
  }

  return {
    raw,
    digits,
    national10,
    canonical,
    candidates: Array.from(candidatesSet)
  };
}

