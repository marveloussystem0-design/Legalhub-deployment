export interface ParsedCase {
  cnr_number?: string;
  cino?: string;
  case_number: string;
  case_type: string;
  court_name: string;
  filing_date?: string;
  petitioner_name: string;
  respondent_name: string;
  status: string;
  next_hearing?: {
    hearing_date: string;
    hearing_type: string;
  };
  judge_name?: string;
  court_room_no?: string;
}

export interface ParseResult {
  success: boolean;
  data: ParsedCase[];
  errors: { line: number; message: string }[];
}

type JsonLike = Record<string, unknown>;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Parses text/JSON content into structured case data
 * Supports:
 * 1. Pipe-delimited CSV: CNR|Case No|Type|Court|Date|Petitioner|Respondent|Status
 * 2. eCourts JSON Format
 */
export function parseBulkImportFile(content: string): ParseResult {
  const contentTrimmed = content.trim();

  if (contentTrimmed.startsWith('[') || contentTrimmed.startsWith('{') || contentTrimmed.startsWith('"')) {
    const jsonResult = parseJsonFormat(contentTrimmed);
    if (jsonResult.success && jsonResult.data.length > 0) {
      return jsonResult;
    }
  }

  return parseCsvFormat(contentTrimmed);
}

function parseJsonFormat(content: string): ParseResult {
  const parsedData: ParsedCase[] = [];
  const errors: { line: number; message: string }[] = [];

  try {
    let jsonData: unknown;

    try {
      jsonData = JSON.parse(content);
    } catch {
      const fixedContent = '[' + content.replace(/}\s*{/g, '},{') + ']';
      try {
        jsonData = JSON.parse(fixedContent);
      } catch (e2) {
        const lines = content.split('\n');
        const collected: unknown[] = [];
        lines.forEach((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          try {
            collected.push(JSON.parse(trimmed));
          } catch {
            errors.push({ line: idx + 1, message: 'Invalid JSON line' });
          }
        });
        if (collected.length === 0) throw e2;
        jsonData = collected;
      }
    }

    if (typeof jsonData === 'string') {
      while (typeof jsonData === 'string') {
        try {
          jsonData = JSON.parse(jsonData);
        } catch {
          break;
        }
      }
    }

    const items: unknown[] = Array.isArray(jsonData) ? jsonData : [jsonData];

    items.forEach((item, index) => {
      try {
        let current: unknown = item;
        if (typeof current === 'string') {
          try {
            current = JSON.parse(current);
          } catch {
            // keep as string; mapping below will default
          }
        }

        const obj: JsonLike = (typeof current === 'object' && current !== null) ? (current as JsonLike) : {};

        const mappedCase: ParsedCase = {
          cino: asString(obj.cino) || asString(obj.cnr_number) || '',
          cnr_number: asString(obj.cino) || asString(obj.cnr_number) || '',
          case_number: asString(obj.case_no) || asString(obj.case_number) || 'Unknown',
          case_type: asString(obj.type_name) || asString(obj.case_type) || 'Civil',
          court_name: asString(obj.establishment_name) || asString(obj.court_name) || 'Unknown Court',
          filing_date: asString(obj.date_of_filing) || asString(obj.filing_date) || undefined,
          petitioner_name: asString(obj.petparty_name) || asString(obj.petitioner) || asString(obj.petitioner_name) || 'Unknown',
          respondent_name: asString(obj.resparty_name) || asString(obj.respondent) || asString(obj.respondent_name) || 'Unknown',
          status: mapStatus(asString(obj.disp_name) || asString(obj.status) || null),
          judge_name: asString(obj.court_no_desg_name) || undefined,
        };

        const nextList = asString(obj.date_next_list);
        if (nextList) {
          mappedCase.next_hearing = {
            hearing_date: nextList,
            hearing_type: asString(obj.purpose_name) || 'Hearing'
          };
        }

        parsedData.push(mappedCase);
      } catch (err: unknown) {
        errors.push({ line: index + 1, message: getErrorMessage(err) });
      }
    });
  } catch (e: unknown) {
    if (parsedData.length === 0) {
      return {
        success: false,
        data: [],
        errors: [{ line: 0, message: 'Invalid JSON format: ' + getErrorMessage(e) }]
      };
    }
  }

  return {
    success: errors.length === 0 || parsedData.length > 0,
    data: parsedData,
    errors
  };
}

function parseCsvFormat(content: string): ParseResult {
  const lines = content.split('\n');
  const parsedData: ParsedCase[] = [];
  const errors: { line: number; message: string }[] = [];

  const startIndex = lines[0].toLowerCase().includes('cnr') ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split('|').map(v => v.trim());

    if (values.length < 2) {
      errors.push({ line: i + 1, message: 'Invalid format: Not enough columns' });
      continue;
    }

    const [
      cino,
      case_number = 'Unknown',
      case_type = 'Unknown',
      court_name = 'Unknown Court',
      filing_date,
      petitioner_name = 'Unknown',
      respondent_name = 'Unknown',
      status = 'open'
    ] = values;

    if (!cino) {
      errors.push({ line: i + 1, message: 'Missing CNR Number/CINO' });
      continue;
    }

    const validDate = filing_date && !isNaN(Date.parse(filing_date)) ? filing_date : undefined;

    parsedData.push({
      cino,
      cnr_number: cino,
      case_number,
      case_type,
      court_name,
      filing_date: validDate,
      petitioner_name,
      respondent_name,
      status: status.toLowerCase()
    });
  }

  return {
    success: errors.length === 0,
    data: parsedData,
    errors
  };
}

function mapStatus(status: string | null): string {
  if (!status) return 'open';
  const s = status.toLowerCase();
  if (['dismissed', 'disposed', 'decreed', 'allowed', 'withdrawn', 'closed'].includes(s)) {
    return 'closed';
  }
  return 'open';
}
