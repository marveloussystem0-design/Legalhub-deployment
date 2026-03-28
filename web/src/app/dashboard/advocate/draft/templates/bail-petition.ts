import type { DraftTemplateDefinition } from "./types";

export const bailPetitionTemplate = {
  id: "bail-petition",
  title: "Bail Petition",
  subtitle: "Based on Petition format3.pdf",
  description:
    "Editable 2-page advocate template with bracket placeholders, proper cause-title alignment, centered in-between line, and signature space.",
  tier: "minimal",
  content: `
<h1 style="text-align:center;">IN THE COURT OF [COURT_NAME]</h1>
<p style="text-align:center;"><strong>[COURT_PLACE]</strong></p>

<div style="height:28px;"></div>
<p style="text-align:center;"><strong>Crl. M.P. No. [CRL_MP_NO] of [CRL_MP_YEAR]</strong></p>
<p style="text-align:center; margin:16px 0;"><strong>in</strong></p>
<p style="text-align:center;"><strong>Cr. No. [CR_NO] of [CR_YEAR]</strong></p>

<div style="height:44px;"></div>
<div style="margin-top:14px;">
  <p style="margin:0; text-align:left;"><strong>[PETITIONER_NAME]</strong></p>
  <p style="margin:8px 0 0 0; text-align:right;">... Petitioner/Accused</p>
  <p style="text-align:center; margin:18px 0 20px 0;"><strong>---vs---</strong></p>
  <p style="margin:0; text-align:left;"><strong>State rep. by :</strong></p>
  <p style="margin:8px 0 0 0; text-align:left;"><strong>[INSPECTOR_LABEL],</strong></p>
  <p style="margin:8px 0 0 0; text-align:center;"><strong>[POLICE_STATION]</strong></p>
  <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:8px;">
    <p style="width:50%; margin:0; text-align:left;"><strong>[RESPONDENT_CITY]</strong></p>
    <p style="width:50%; margin:0; text-align:right;">... Respondent/Complainant</p>
  </div>
</div>

<div style="height:36px;"></div>
<h2 style="text-align:center; line-height:1.45;">
  <span style="display:inline-block; border-bottom:2px solid #111827; padding-bottom:2px;">
    PETITION FOR BAIL<br />UNDER SECTION [SECTION_DETAILS] OF B.N.S.S.
  </span>
</h2>

<div style="height:24px;"></div>
<p>The Petitioner / Accused submits as follows:</p>

<ol>
  <li>The Petitioner / Accused was arrested by the respondent for alleged offence under Section [SECTION_DETAILS].</li>
  <li>The Petitioner / Accused submits that [HE_SHE] is innocent of the said commission of the offence.</li>
  <li>The Petitioner / Accused undertakes to co-operate with the respondent in the investigation.</li>
  <li>The Petitioner / Accused assures that [HE_SHE] will not tamper with any of the witnesses.</li>
  <li>The Petitioner / Accused undertakes to appear regularly whenever and wherever ordered to do so by this Hon'ble Court and will abide by any condition this Hon'ble Court may be pleased to impose.</li>
</ol>

<p>Hence it is prayed that this Hon'ble Court may be pleased to enlarge the Petitioner / Accused on bail and thus render justice.</p>

<p style="margin-top:26px;">Dated at [DATED_PLACE] on this [DATED_DAY] day of [DATED_MONTH], [DATED_YEAR].</p>

<div style="height:24px;"></div>
<p><strong>M/s / Mr. [PETITIONER_NAME]</strong></p>
<div style="height:24px;"></div>
<p></p>
<p style="text-align:right; margin:0;"><strong>COUNSEL FOR PETITIONER/ACCUSED</strong></p>
<p style="text-align:right; margin:6px 0 0 0;"><strong>Cell: [CELL_NUMBER]</strong></p>
<div style="height:120px;"></div>
<div style="page-break-after:always; break-after:page; border-top:2px dashed #cbd5e1; margin:52px 0;"></div>

<h1 style="text-align:center;">IN THE COURT OF [SECOND_PAGE_COURT_NAME]</h1>
<p style="text-align:center;"><strong>[SECOND_PAGE_COURT_PLACE]</strong></p>

<div style="height:30px;"></div>
<p style="text-align:center;"><strong>Crl. M.P. No. [CRL_MP_NO] of [CRL_MP_YEAR]</strong></p>
<p style="text-align:center; margin:16px 0;"><strong>in</strong></p>
<p style="text-align:center;"><strong>Cr. No. [CR_NO] of [CR_YEAR]</strong></p>

<div style="height:48px;"></div>
<div style="margin-top:14px;">
  <p style="margin:0; text-align:left;"><strong>[PETITIONER_NAME]</strong></p>
  <p style="margin:8px 0 0 0; text-align:right;">... Petitioner/Accused</p>
  <p style="text-align:center; margin:18px 0 20px 0;"><strong>---vs---</strong></p>
  <p style="margin:0; text-align:left;"><strong>State rep. by :</strong></p>
  <p style="margin:8px 0 0 0; text-align:left;"><strong>[INSPECTOR_LABEL],</strong></p>
  <p style="margin:8px 0 0 0; text-align:center;"><strong>[POLICE_STATION]</strong></p>
  <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:8px;">
    <p style="width:50%; margin:0; text-align:left;"><strong>[RESPONDENT_CITY]</strong></p>
    <p style="width:50%; margin:0; text-align:right;">... Respondent/Complainant</p>
  </div>
</div>

<div style="height:34px;"></div>
<h2 style="text-align:center; line-height:1.45;">
  <span style="display:inline-block; border-bottom:2px solid #111827; padding-bottom:2px;">
    PETITION FOR BAIL<br />UNDER SECTION [SECTION_DETAILS] OF B.N.S.S.
  </span>
</h2>

<div style="height:24px;"></div>
<p><strong>M/s / Mr. [PETITIONER_NAME]</strong></p>
<div style="height:24px;"></div>
<p></p>
<p style="text-align:right; margin:0;"><strong>COUNSEL FOR PETITIONER/ACCUSED</strong></p>
<p style="text-align:right; margin:6px 0 0 0;"><strong>Cell: [CELL_NUMBER]</strong></p>
`,
  fields: [
    { key: "COURT_NAME", label: "Court Name" },
    { key: "COURT_PLACE", label: "Court Place" },
    { key: "SECOND_PAGE_COURT_NAME", label: "Second Page Court Name" },
    { key: "SECOND_PAGE_COURT_PLACE", label: "Second Page Court Place" },
    { key: "CRL_MP_NO", label: "Crl. M.P. No." },
    { key: "CRL_MP_YEAR", label: "Crl. M.P. Year" },
    { key: "CR_NO", label: "Cr. No." },
    { key: "CR_YEAR", label: "Cr. Year" },
    { key: "PETITIONER_NAME", label: "Petitioner / Accused" },
    { key: "INSPECTOR_LABEL", label: "State by / Inspector" },
    { key: "RESPONDENT_CITY", label: "State City" },
    { key: "POLICE_STATION", label: "Police Station" },
    { key: "SECTION_DETAILS", label: "Section Details" },
    { key: "HE_SHE", label: "He / She" },
    { key: "DATED_PLACE", label: "Dated Place" },
    { key: "DATED_DAY", label: "Day" },
    { key: "DATED_MONTH", label: "Month" },
    { key: "DATED_YEAR", label: "Year" },
    { key: "CELL_NUMBER", label: "Cell Number" },
  ] as const,
} satisfies DraftTemplateDefinition;
