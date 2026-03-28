
import * as cheerio from 'cheerio'; // We'll need to install this: npm install cheerio

export interface ScrapedVCLink {
  court_name: string;
  judge_name?: string;
  district?: string;
  meeting_link: string;
}

/**
 * Scrapes VC links from the official Chennai eCourts page
 * URL: https://chennai.dcourts.gov.in/hybrid-vc-microsoft-teams-links-for-all-the-courts-functioning-in-chennai-district/
 */
export async function scrapeChennaiVCLinks(): Promise<ScrapedVCLink[]> {
  const URL = 'https://chennai.dcourts.gov.in/hybrid-vc-microsoft-teams-links-for-all-the-courts-functioning-in-chennai-district/';
  
  try {
    console.log(`📡 Fetching live VC links from: ${URL}`);
    const response = await fetch(URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const links: ScrapedVCLink[] = [];

    // Find the main table. Usually the first table or one with a specific class.
    // We'll iterate the first table found in the content area.
    const table = $('table').first();
    
    if (table.length === 0) {
        console.error('❌ No table found in the page!');
        return [];
    }

    const rows = table.find('tr');
    console.log(`📊 Found ${rows.length} rows in the table.`);

    rows.each((i, row) => {
      // Skip likely header rows (checking if first cell is header or text 'Court')
      if (i < 2 && $(row).text().toLowerCase().includes('court')) return; 

      const cols = $(row).find('td');
      
      // Heuristic: 
      // Col 0 or 1 usually Court Name
      // Col with 'href' is the link
      
      let courtName = '';
      let link = '';
      
      // Inspect columns
      if (cols.length >= 2) {
          const txt1 = $(cols[1]).text().trim(); // Location (e.g., Chennai, Egmore)
          const txt2 = $(cols[2]).text().trim(); // Court Name (e.g., I Additional District Court)

          // CORRECT MAPPING based on HTML Dump
          if (txt2 && txt2.length > 5) {
             courtName = txt2; // Specific Court Name
             // Store location via district field below
          } else if (txt1 && txt1.length > 5 && isNaN(parseInt(txt1))) {
             // Fallback
             courtName = txt1;
          }

          // Find Link
          const href = $(row).find('a').attr('href');
          if (href && href.includes('teams.microsoft.com')) {
              link = href;
          }
      }

      if (courtName && link) {
        links.push({
          court_name: courtName,
          judge_name: '', // No judge name in table, leave empty
          district: $(cols[1]).text().trim(), // Capture location
          meeting_link: link,
        });
      }
    });
    
    console.log(`✅ Extracted ${links.length} valid links.`);
    return links;

  } catch (error) {
    console.error('Error scraping VC links:', error);
    return [];
  }
}


