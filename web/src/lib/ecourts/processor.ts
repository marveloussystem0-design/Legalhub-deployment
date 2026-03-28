import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

type ApiData = Record<string, string | null | undefined>;
type MetadataRecord = Record<string, unknown>;
type DomNode = AnyNode;

interface ActEntry {
  act: string;
  section: string;
}

interface HistoryEntry {
  judge: string;
  business_date: string;
  hearing_date: string;
  purpose: string;
}

export interface ScraperResult {
  success: boolean;
  data?: {
    api_data: ApiData;
    raw_html?: string;
  };
  error?: string;
}


/*
====================================================
UTILS
====================================================
*/

function cleanName(name: string | null | undefined): string | null {
  if (!name) return null;

  const cleaned = name
    .replace(/^\d+\)\s*/, "")
    .replace(/\badvocate\s*[-:]\s*.*$/i, "")
    .replace(/\(\s*advocate.*?\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;

  const lower = cleaned.toLowerCase();

  if (
    lower.includes("view qr") ||
    lower === "petitioner" ||
    lower === "respondent" ||
    lower === "petitioner and advocate" ||
    lower === "respondent and advocate" ||
    lower === "advocate"
  ) {
    return null;
  }

  if (cleaned.length < 2) return null;

  return cleaned;
}

function normalizeText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function looksLikeHeader(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("petitioner and advocate") ||
    lower.includes("respondent and advocate") ||
    lower === "petitioner" ||
    lower === "respondent" ||
    lower.includes("party name") ||
    lower.includes("advocate name") ||
    lower === "s.no." ||
    lower === "sno"
  );
}

function parseDateFlexible(val?: string | null): string | null {
  if (!val) return null;

  const cleaned = val.replace(/(st|nd|rd|th)/gi, "").trim();

  const ddmmyyyy = cleaned.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);

  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;

    const iso = new Date(
      `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
    );

    if (!isNaN(iso.getTime())) return iso.toISOString();
  }

  const parsed = new Date(cleaned);

  if (!isNaN(parsed.getTime())) return parsed.toISOString();

  return null;
}

function normalizeNextHearingDate(val?: string | null): string | null {
  const parsed = parseDateFlexible(val);
  if (!parsed) return null;

  const hearingDate = parsed.split("T")[0];
  const todayDate = new Date().toISOString().split("T")[0];

  // If the "next hearing" is already in the past, treat it as stale.
  if (hearingDate < todayDate) return null;

  return parsed;
}

function pickEarliestUpcomingDate(values: Array<string | null | undefined>): string | null {
  const normalized = values
    .map((val) => normalizeNextHearingDate(val))
    .filter((val): val is string => Boolean(val));

  if (normalized.length === 0) return null;

  normalized.sort((a, b) => a.localeCompare(b));
  return normalized[0];
}


/*
====================================================
MAIN
====================================================
*/

export function parseScraperResult(
  result: ScraperResult,
  cnr: string
) {
  if (!result.success) return null;

  const api: ApiData = result.data?.api_data || {};
  const html = result.data?.raw_html || "";
  const $ = cheerio.load(html);
  const debugCnr = (cnr || "").toUpperCase();
  const shouldDebug =
    debugCnr === "TNCH0D0080172023" ||
    debugCnr === "TNCH0D0080172024";


  /*
  ====================================
  CORE VARIABLES
  ====================================
  */

  let petitioner: string | null = null;
  let respondent: string | null = null;

  let courtName =
    api.establishment_name ||
    api.court_name ||
    null;

  let caseType =
    api.type_name ||
    api.case_type ||
    null;

  const caseNumber = cnr;

  let judgeName =
    api.judge_name ||
    null;

  let filingDate: string | null = null;
  let registrationDate: string | null = null;
  let decisionDate: string | null = null;
  let disposalNature: string | null = null;
  let nextHearing: string | null = null;

  let caseStatus:
    | "open"
    | "closed"
    | "unknown" =
    "unknown";


  /*
  ====================================
  DETAILS TABLE
  ====================================
  */

  const fullDetails: Record<string, string> = {};

  const normalizeDetailKey = (key: string): string => {
    return normalizeText(key.replace(/[:\u00a0]+/g, " "));
  };

  const ingestDetailField = (rawKey: string, rawVal: string) => {
    const key = normalizeDetailKey(rawKey);
    let val = normalizeText(rawVal).replace(/\s*View QR Code.*$/i, "").trim();
    if (!key || !val || val === "-") return;

    const lowerKey = key.toLowerCase();
    const lowerVal = val.toLowerCase();

    // Skip obvious shifted-header junk values from malformed table rows.
    if (
      lowerVal === "next date (purpose)" ||
      lowerVal === "e-filing date" ||
      lowerVal === "under section(s)" ||
      lowerVal === "under act(s)"
    ) {
      return;
    }

    // Clean CNR rows where portal appends note text in the same cell.
    if (lowerKey.includes("cnr")) {
      val = val.replace(/\s*\(note.*$/i, "").trim();
    }

    fullDetails[key] = val;

    if (lowerKey.includes("filing date")) {
      filingDate = parseDateFlexible(val) || filingDate;
    }

    if (lowerKey.includes("registration date")) {
      registrationDate = parseDateFlexible(val) || registrationDate;
    }

    if (lowerKey.includes("decision date")) {
      decisionDate = parseDateFlexible(val) || decisionDate;
    }

    if (lowerKey.includes("nature of disposal")) {
      disposalNature = val;
    }

    if (
      lowerKey.includes("court number and judge") ||
      (lowerKey.includes("judge") && !judgeName)
    ) {
      judgeName = val;
    }

    if (lowerKey.includes("case type")) {
      caseType = val;
    }

    if (!courtName && (lowerKey.includes("court") || lowerKey.includes("establishment"))) {
      courtName = val;
    }
  };

  $(
    ".case_details_table tr, \
     .case_details tr, \
     .case-details tr, \
     #caseDetails tr"
  ).each((_, row) => {
    const cells = $(row)
      .find("th, td")
      .toArray()
      .map((cell) => normalizeText($(cell).text()))
      .filter(Boolean);

    if (cells.length >= 2) {
      for (let i = 0; i < cells.length - 1; i += 2) {
        ingestDetailField(cells[i], cells[i + 1]);
      }
    }
  });

  // Fallback: parse detail-like key/value rows from all tables.
  $("table tr").each((_, row) => {
    const cells = $(row)
      .find("th, td")
      .toArray()
      .map((cell) => normalizeText($(cell).text()))
      .filter(Boolean);

    if (cells.length < 2) return;

    for (let i = 0; i < cells.length - 1; i += 2) {
      const key = normalizeDetailKey(cells[i]).toLowerCase();
      if (
        key.includes("case type") ||
        key.includes("filing") ||
        key.includes("registration") ||
        key.includes("cnr") ||
        key.includes("first hearing") ||
        key.includes("decision") ||
        key.includes("case status") ||
        key.includes("nature of disposal") ||
        key.includes("court number and judge")
      ) {
        ingestDetailField(cells[i], cells[i + 1]);
      }
    }
  });

  if (!courtName) {
    const bodyText = normalizeText($("body").text());
    const courtMatch = bodyText.match(/(.+?)\s+Case Details/i);
    if (courtMatch?.[1]) {
      const possibleCourt = normalizeText(courtMatch[1]);
      if (
        possibleCourt &&
        !possibleCourt.toLowerCase().includes("ecourts")
      ) {
        courtName = possibleCourt;
      }
    }
  }


  /*
  ====================================
  STATUS
  ====================================
  */

  const rawStatus = (
    api.case_status ||
    api.disp_name ||
    fullDetails["Case Status"] ||
    fullDetails["Case status"] ||
    fullDetails["Status"] ||
    ""
  ).toLowerCase();

  if (
    rawStatus.includes("disposed") ||
    rawStatus.includes("decided")
  ) {
    caseStatus = "closed";
  } else if (
    rawStatus.includes("pending") ||
    rawStatus.includes("active")
  ) {
    caseStatus = "open";
  }

  if (api.date_next_list) {
    nextHearing = normalizeNextHearingDate(api.date_next_list);
  }


  /*
  ====================================
  UNIVERSAL PARTY EXTRACTION
  ====================================
  */

  const petitionerDetails: string[] = [];
  const respondentDetails: string[] = [];

  const petitionerSet = new Set<string>();
  const respondentSet = new Set<string>();

  const addPetitioner = (value: string | null | undefined) => {
    const cleaned = cleanName(value);
    if (!cleaned) return;
    if (!petitioner) petitioner = cleaned;
    if (!petitionerSet.has(cleaned)) {
      petitionerSet.add(cleaned);
      petitionerDetails.push(cleaned);
    }
  };

  const addRespondent = (value: string | null | undefined) => {
    const cleaned = cleanName(value);
    if (!cleaned) return;
    if (!respondent) respondent = cleaned;
    if (!respondentSet.has(cleaned)) {
      respondentSet.add(cleaned);
      respondentDetails.push(cleaned);
    }
  };

  const splitPartyField = (value: string | null | undefined): string[] => {
    const normalized = normalizeText(value);
    if (!normalized) return [];

    return normalized
      .split(/\s*(?:,|;|\n|\/|&|\band\b)\s*/i)
      .map((item) => normalizeText(item))
      .filter(Boolean);
  };

  const addFromApiParties = (
    value: string | null | undefined,
    type: "petitioner" | "respondent"
  ) => {
    for (const party of splitPartyField(value)) {
      if (type === "petitioner") addPetitioner(party);
      else addRespondent(party);
    }
  };

  addFromApiParties(
    api.petparty_name ||
      api.petitioner_name ||
      api.pet_name ||
      api.petitioner ||
      api.party1 ||
      null,
    "petitioner"
  );

  addFromApiParties(
    api.resparty_name ||
      api.respondent_name ||
      api.res_name ||
      api.respondent ||
      api.party2 ||
      null,
    "respondent"
  );

  const extractInlineParty = (text: string) => {
    const normalized = normalizeText(text);
    const lower = normalized.toLowerCase();

    const petitionerMatch = normalized.match(/petitioner\s*[:\-]?\s*(.+)$/i);
    if (petitionerMatch) {
      addPetitioner(petitionerMatch[1]);
      return;
    }

    const respondentMatch = normalized.match(/respondent\s*[:\-]?\s*(.+)$/i);
    if (respondentMatch) {
      addRespondent(respondentMatch[1]);
      return;
    }

    const vsMatch = normalized.match(/(.+?)\s+v(?:s|\.)\s+(.+)/i);
    if (vsMatch) {
      addPetitioner(vsMatch[1]);
      addRespondent(vsMatch[2]);
      return;
    }

    if (lower.includes("petitioner")) {
      addPetitioner(
        normalized
          .replace(/petitioner\s*[:\-]?/gi, "")
          .replace(/and\s+advocate/gi, "")
      );
      return;
    }

    if (lower.includes("respondent")) {
      addRespondent(
        normalized
          .replace(/respondent\s*[:\-]?/gi, "")
          .replace(/and\s+advocate/gi, "")
      );
    }
  };

  const extractFromRows = (
    rows: cheerio.Cheerio<DomNode>,
    tableHint: "petitioner" | "respondent" | "unknown"
  ) => {
    rows.each((_: number, row: DomNode) => {
      const cells = $(row)
        .find("th, td")
        .toArray()
        .map((cell) => normalizeText($(cell).text()))
        .filter(Boolean);

      const rowText = normalizeText($(row).text());
      if (!rowText || looksLikeHeader(rowText)) return;

      const lowerRow = rowText.toLowerCase();

      if (
        lowerRow.includes("petitioner") ||
        lowerRow.includes("respondent") ||
        /\bv(?:s|\.)\b/i.test(rowText)
      ) {
        extractInlineParty(rowText);
      }

      if (cells.length >= 2) {
        const label = cells[0].toLowerCase();
        const value = cells.slice(1).join(" ");

        if (label.includes("petitioner")) {
          addPetitioner(value);
          return;
        }

        if (label.includes("respondent")) {
          addRespondent(value);
          return;
        }
      }

      const valueCell = cells.find((cell) => !looksLikeHeader(cell));
      if (!valueCell) return;

      if (tableHint === "petitioner") {
        addPetitioner(valueCell);
        return;
      }

      if (tableHint === "respondent") {
        addRespondent(valueCell);
        return;
      }

      if (!petitioner) {
        addPetitioner(valueCell);
      } else if (!respondent) {
        addRespondent(valueCell);
      }
    });
  };

  const partySelectors = [
    ".Petitioner_Advocate_table",
    ".Respondent_Advocate_table",
    ".case_party_table",
    ".party_table",
    "#petitioner_table",
    "#respondent_table",
    ".Petitioner_table",
    ".Respondent_table"
  ];

  const partyTables = new Set<DomNode>();
  const selectorHits: Record<string, number> = {};

  partySelectors.forEach((selector) => {
    const matches = $(selector).length;
    selectorHits[selector] = matches;

    $(selector).each((_, table) => {
      partyTables.add(table);
      const lowerSel = selector.toLowerCase();
      const hint: "petitioner" | "respondent" | "unknown" =
        lowerSel.includes("petitioner")
          ? "petitioner"
          : lowerSel.includes("respondent")
            ? "respondent"
            : "unknown";

      extractFromRows($(table).find("tr"), hint);
    });
  });

  $("table").each((_, table) => {
    if (partyTables.has(table)) return;

    const idClass = normalizeText(
      `${$(table).attr("id") || ""} ${$(table).attr("class") || ""}`
    ).toLowerCase();

    const tableText = normalizeText($(table).text()).toLowerCase();

    const isPartyTable =
      idClass.includes("petitioner") ||
      idClass.includes("respondent") ||
      idClass.includes("party") ||
      tableText.includes("petitioner") ||
      tableText.includes("respondent");

    if (!isPartyTable) return;

    partyTables.add(table);

    const hint: "petitioner" | "respondent" | "unknown" =
      idClass.includes("petitioner")
        ? "petitioner"
        : idClass.includes("respondent")
          ? "respondent"
          : "unknown";

    extractFromRows($(table).find("tr"), hint);
  });

  const extractByTableText = (
    selector: string,
    type: "petitioner" | "respondent"
  ) => {
    $(selector).each((_, table) => {
      const tableText = normalizeText($(table).text());
      if (!tableText) return;

      const chunks = tableText.match(/(\d+\)\s*[\s\S]*?)(?=\s+\d+\)\s*|$)/g) || [];

      if (chunks.length > 0) {
        chunks.forEach((chunk) => {
          const cleaned = normalizeText(
            chunk
              .replace(/petitioner\s*(?:\/\s*plaintiff)?/gi, "")
              .replace(/respondent\s*(?:\/\s*defendant)?/gi, "")
              .replace(/petitioner and advocate/gi, "")
              .replace(/respondent and advocate/gi, "")
          );

          if (type === "petitioner") addPetitioner(cleaned);
          else addRespondent(cleaned);
        });
        return;
      }

      // Some responses flatten the table into a single string without numbered chunks.
      const cleaned = normalizeText(
        tableText
          .replace(/petitioner\s*(?:\/\s*plaintiff)?/gi, "")
          .replace(/respondent\s*(?:\/\s*defendant)?/gi, "")
          .replace(/petitioner and advocate/gi, "")
          .replace(/respondent and advocate/gi, "")
      );

      if (type === "petitioner") addPetitioner(cleaned);
      else addRespondent(cleaned);
    });
  };

  if (petitionerDetails.length === 0 && selectorHits[".Petitioner_Advocate_table"] > 0) {
    extractByTableText(".Petitioner_Advocate_table", "petitioner");
  }

  if (respondentDetails.length === 0 && selectorHits[".Respondent_Advocate_table"] > 0) {
    extractByTableText(".Respondent_Advocate_table", "respondent");
  }

  if (shouldDebug) {
    console.log(
      `[eCourts][processor] ${debugCnr} raw_html length=${html.length} table_count=${$("table").length}`
    );
    console.log(
      `[eCourts][processor] ${debugCnr} selector_hits=${JSON.stringify(selectorHits)}`
    );
    console.log(
      `[eCourts][processor] ${debugCnr} extracted petitioner_details=${JSON.stringify(
        petitionerDetails
      )} respondent_details=${JSON.stringify(respondentDetails)}`
    );
  }


  /*
  ====================================
  VS TITLE FALLBACK
  ====================================
  */

  if (!petitioner || !respondent) {
    const body = $("body").text().replace(/\s+/g, " ").trim();

    const vs = body.match(/(.*?)\s+vs\.?\s+(.*?)(?:\s+case\b|\s+cnr\b|$)/i);

    if (vs) {
      if (!petitioner) addPetitioner(vs[1]);
      if (!respondent) addRespondent(vs[2]);
    }
  }

  if (!petitioner || !respondent) {
    const fallbackPetitioner =
      api.petparty_name ||
      api.petitioner_name ||
      api.petitioner ||
      api.pet_name ||
      api.party1 ||
      null;

    const fallbackRespondent =
      api.resparty_name ||
      api.respondent_name ||
      api.respondent ||
      api.res_name ||
      api.party2 ||
      null;

    if (!petitioner) addPetitioner(fallbackPetitioner);
    if (!respondent) addRespondent(fallbackRespondent);
  }

  if (petitioner && petitionerDetails.length === 0) {
    petitionerDetails.push(petitioner);
  }

  if (respondent && respondentDetails.length === 0) {
    respondentDetails.push(respondent);
  }

  if (partyTables.size > 0) {
    if (!fullDetails["Petitioner"] && petitioner) {
      fullDetails["Petitioner"] = petitioner;
    }

    if (!fullDetails["Respondent"] && respondent) {
      fullDetails["Respondent"] = respondent;
    }

    if (Object.keys(fullDetails).length < 2) {
      fullDetails["Party Details Extracted"] = "true";
      fullDetails["Party Table Count"] = String(partyTables.size);
    }
  }


  /*
  ====================================
  ACTS
  ====================================
  */

  const acts: ActEntry[] = [];

  $("table").each((_, table) => {
    const header =
      $(table)
        .find("th")
        .first()
        .text()
        .toLowerCase();

    if (header.includes("act")) {
      $(table)
        .find("tr")
        .each((i, row) => {
          if (i === 0) return;

          const tds = $(row).find("td");

          if (tds.length > 1) {
            acts.push({
              act: tds.eq(0).text(),
              section: tds.eq(1).text()
            });
          }
        });
    }
  });


  /*
  ====================================
  HISTORY
  ====================================
  */

  const history: HistoryEntry[] = [];

  $(
    "#history_cnr tr, \
     .history_table tr"
  ).each((i, row) => {
    if (i === 0) return;

    const tds = $(row).find("td");

    if (tds.length < 3) return;

    history.push({
      judge: tds.eq(0).text(),
      business_date: tds.eq(1).text(),
      hearing_date: tds.eq(2).text(),
      purpose: tds.eq(3).text()
    });
  });

  if (!nextHearing) {
    const nextFromDetails = pickEarliestUpcomingDate([
      fullDetails["Next Hearing Date"],
      fullDetails["Next Date (Purpose)"],
      fullDetails["Next Date"]
    ]);

    const nextFromHistory = pickEarliestUpcomingDate(
      history.flatMap((h) => [h.hearing_date, h.business_date])
    );

    nextHearing = nextFromDetails || nextFromHistory;
  }

  if (shouldDebug) {
    console.log(
      `[eCourts][processor] ${debugCnr} next_hearing candidates api=${JSON.stringify(
        api.date_next_list || null
      )} details=${JSON.stringify(
        fullDetails["Next Hearing Date"] ||
          fullDetails["Next Date (Purpose)"] ||
          fullDetails["Next Date"] ||
          null
      )} resolved=${JSON.stringify(nextHearing)}`
    );
  }


  /*
  ====================================
  RETURN NORMALIZED OBJECT
  ====================================
  */

  return {
    petitioner,
    respondent,
    courtName,
    caseType,
    caseNumber,
    registrationDate,
    filingDate,
    nextHearingDate: nextHearing,
    caseStatus,
    disposalDate: decisionDate,
    disposalNature,
    judgeName,
    hearings: history,
    acts,
    fullDetails,
    rawMetadata: {
      petitioner_details: petitionerDetails,
      respondent_details: respondentDetails,
      history,
      acts,
      source: api ? "HYBRID" : "HTML"
    },
    metadata: {
      petitioner_details: petitionerDetails,
      respondent_details: respondentDetails,
      history,
      acts,
      parsed_fields: {
        petitioner: petitioner || null,
        respondent: respondent || null,
        case_number: caseNumber,
        court_name: courtName
      },
      full_details: fullDetails
    }
  };
}

/*
====================================================
COMPATIBILITY EXPORTS FOR ROUTE + WEB
====================================================
*/

export function isMetadataSparse(metadata: MetadataRecord | null | undefined): boolean {
  if (!metadata) return true;

  const withDetails = metadata as {
    full_details?: MetadataRecord;
    fullDetails?: MetadataRecord;
  };

  const details =
    withDetails.full_details ||
    withDetails.fullDetails ||
    {};

  return Object.keys(details).length < 2;
}



export function scrubMetadata(metadata: MetadataRecord | null | undefined) {
  if (!metadata) return metadata;

  const withDetails = metadata as {
    full_details?: Record<string, unknown>;
  };

  const cleaned = Object.entries(
    withDetails.full_details || {}
  ).reduce((acc: Record<string, unknown>, [k, v]) => {
    if (
      k &&
      v &&
      v !== "None" &&
      v !== "-"
    ) {
      acc[k] = v;
    }

    return acc;
  }, {});

  return {
    ...metadata,
    full_details: cleaned
  };
}



export function generateCaseTitle(
  petitioner?: string | null,
  respondent?: string | null,
  caseNumber?: string | null
) {
  if (petitioner && respondent)
    return `${petitioner} vs ${respondent}`;

  if (petitioner)
    return petitioner;

  if (respondent)
    return respondent;

  return caseNumber || "Unknown Case";
}
