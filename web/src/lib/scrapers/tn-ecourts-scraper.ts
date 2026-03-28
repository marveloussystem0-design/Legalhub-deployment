/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { puppeteerClient } from './puppeteer-client';

// URL for "Case Status by CNR Number" (Main TN Gateway)
const CNR_SEARCH_URL = 'https://services.ecourts.gov.in/ecourtindia_v6/';

// Memory store handle for Next.js HMR survival
const SESSIONS_KEY = '_tn_ecourts_active_sessions';
function getSessionsMap(): Map<string, { page: any; context: any; timestamp: number }> {
    if (typeof global !== 'undefined') {
        if (!(global as any)[SESSIONS_KEY]) {
            (global as any)[SESSIONS_KEY] = new Map();
        }
        return (global as any)[SESSIONS_KEY];
    }
    return new Map();
}

export class TNEcourtsScraper {
  private static readonly CNR_SEARCH_URL = CNR_SEARCH_URL;

  private static get activeSessions() {
    return getSessionsMap();
  }

  /**
   * Fetches the Captcha from the eCourts Portal.
   */
  static async fetchCaptcha(cnrHint?: string): Promise<{ imageBase64: string; sessionId: string; status: string }> {
    try {
      // Cleanup old sessions (older than 10 mins)
      const now = Date.now();
      const sessions = this.activeSessions;
      console.log(`[TN Scraper] Current active sessions: ${sessions.size}`);
      
      for (const [id, session] of sessions.entries()) {
          if (now - session.timestamp > 600000) {
              console.log(`[TN Scraper] Cleaning up expired session: ${id}`);
              await session.context.close().catch(() => {});
              sessions.delete(id);
          }
      }

      const browser = await puppeteerClient.getBrowser();
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      
      // Forward browser console logs to Node terminal
      page.on('console', msg => {
          if (!msg.text().includes('Request interception')) {
              console.log(`🌐 [Browser] ${msg.text()}`);
          }
      });
      
      const portalUrl = this.CNR_SEARCH_URL;

      // 1. Optimize Resource Loading
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const type = req.resourceType();
        if (type === 'font') {
          req.abort();
        } else {
          req.continue();
        }
      });

      // 2. Navigate to Portal with Retries
      let navSuccess = false;
      let lastNavError;
      for (let i = 0; i < 3; i++) {
          try {
              console.log(`🌐 [TN Scraper] Navigating to ${portalUrl} (Attempt ${i + 1}/3)...`);
              await page.goto(portalUrl, { 
                  waitUntil: i === 0 ? 'networkidle2' : 'domcontentloaded', 
                  timeout: 30000 
              });
              navSuccess = true;
              break;
          } catch (e: any) {
              lastNavError = e;
              console.warn(`⚠️ [TN Scraper] Navigation attempt ${i + 1} failed: ${e.message}`);
              if (i < 2) await new Promise(r => setTimeout(r, 2000));
          }
      }

      if (!navSuccess) {
          throw lastNavError || new Error(`Failed to navigate to portal after 3 attempts`);
      }

      // 3. Find Captcha Image
      const captchaSelector = '#captcha_image';
      const fallbackSelector = '#captcha, #securimage, #captcha_image_inner';
      
      console.log(`🔍 [TN Scraper] Waiting for captcha on ${portalUrl}...`);
      
      let finalSelector = captchaSelector;
      try {
          await page.waitForSelector(captchaSelector, { timeout: 15000 });
      } catch (e) {
          console.warn(`⚠️ [TN Scraper] Primary selector failed, trying fallback...`);
          await page.waitForSelector(fallbackSelector, { timeout: 10000 });
          const found = await page.evaluate((sel1: string, sel2: string) => {
              if (document.querySelector(sel1)) return sel1;
              const matches = sel2.split(',').map(s => s.trim());
              for (const m of matches) {
                  if (document.querySelector(m)) return m;
              }
              return sel1;
          }, captchaSelector, fallbackSelector);
          finalSelector = found;
      }

      // 4. Wait for the image to be fully loaded and decoded
      await page.waitForFunction((sel: string) => {
          const img = document.querySelector(sel) as any;
          return img && img.complete && img.naturalHeight > 0 && img.src && !img.src.includes('loading');
      }, { timeout: 10000 }, finalSelector);

      // Settle time for any background token updates
      await new Promise(r => setTimeout(r, 1000));

      const captchaElement = await page.$(finalSelector);
      if (!captchaElement) {
          throw new Error('Captcha element not found');
      }

      const imageBuffer = await captchaElement.screenshot({ encoding: 'base64' });
      
      // 5. Get Cookies (Session ID) - We generate a local handle for the live page
      const sessionId = Math.random().toString(36).substring(2, 10);
      this.activeSessions.set(sessionId, { page, context, timestamp: Date.now() });
      console.log(`✅ [TN Scraper] Session stored: ${sessionId} (Total: ${this.activeSessions.size})`);

      return {
        imageBase64: `data:image/png;base64,${imageBuffer}`,
        sessionId: sessionId,
        status: 'success'
      };

    } catch (error: any) {
      console.error('❌ [TN Scraper] Fetch Captcha Failed:', error);
      return {
        imageBase64: '',
        sessionId: '',
        status: 'error'
      };
    }
  }

  /**
   * Submits the solved Captcha and scrapes the Case Status.
   */
  static async submitCaptcha(sessionId: string, captchaCode: string, cnrNumber: string): Promise<any> {
    const sessions = this.activeSessions;
    const session = sessions.get(sessionId);
    
    if (!session) {
        console.error(`❌ [TN Scraper] Session NOT FOUND: ${sessionId}. Available:`, Array.from(sessions.keys()));
        return { success: false, error: 'Session expired or not found. Please refresh the captcha.' };
    }

    // 1. LOCK the session immediately by deleting from map to prevent race conditions
    sessions.delete(sessionId);
    console.log(`🎯 [TN Scraper] Found and LOCKED session: ${sessionId}`);
    
    const { page, context } = session;
    try {
      // 2. Fill Form (Should be on the same page from fetchCaptcha)
      const cnrInputSelector = '#cino'; 
      const captchaInputSelector = await page.evaluate(() => {
          if (document.querySelector('#fcaptcha_code')) return '#fcaptcha_code';
          if (document.querySelector('#captcha')) return '#captcha';
          return '#fcaptcha_code'; 
      });
      const submitBtnSelector = 'input[type="submit"], button[type="submit"], #searchbtn'; 

      await page.waitForSelector(cnrInputSelector, { timeout: 10000 });
      
      // Clear inputs more robustly (Focus + Ctrl+A + Backspace)
      const robustClear = async (selector: string) => {
          await page.click(selector);
          await page.keyboard.down('Control');
          await page.keyboard.press('A');
          await page.keyboard.up('Control');
          await page.keyboard.press('Backspace');
          // Fallback verify
          await page.evaluate((sel: string) => { (document.querySelector(sel) as any).value = ''; }, selector);
      };

      await robustClear(cnrInputSelector);
      await robustClear(captchaInputSelector);
      
      // Clear any existing error messages
      await page.evaluate(() => {
          const err = document.querySelector('.error_msg, #msg, .err_msg');
          if (err) err.innerHTML = '';
      });
      
      // Log tokens for diagnosis
      const tokens: any = await page.evaluate(() => {
          const map: any = {};
          document.querySelectorAll('input[type="hidden"]').forEach(el => {
              const name = el.getAttribute('name') || el.getAttribute('id');
              if (name && name.includes('token')) map[name] = (el as any).value;
          });
          return map;
      });
      console.log(`🔑 [TN Scraper] Hidden tokens: ${JSON.stringify(tokens)}`);

      // Give DOM a moment to settle
      await new Promise(r => setTimeout(r, 600));

      // Type with human-like delay to ensure JS listeners catch every character
      await page.type(cnrInputSelector, cnrNumber, { delay: 100 });
      
      // Verification log (masking middle for privacy)
      const maskedCaptcha = captchaCode.length > 2 
          ? captchaCode[0] + '*'.repeat(captchaCode.length - 2) + captchaCode[captchaCode.length-1]
          : captchaCode;
      console.log(`⌨️ [TN Scraper] Typing captcha: ${maskedCaptcha} (100ms delay)`);
      
      await page.type(captchaInputSelector, captchaCode, { delay: 100 });

      // FINAL STABILIZATION: Some portals need a moment to update tokens in hidden fields after typing
      await new Promise(r => setTimeout(r, 1000));

      // 3. Intercept relevant AJAX responses
      // The portal's funViewCinoHistory() POSTs to searchByCNR and gets JSON back.
      // On error: { errormsg: "Invalid Captcha...", div_captcha: "..." }
      // On success: { errormsg: "", div_case: "<table>...case details...</table>", ... }
      console.log(`🚀 [TN Scraper] Submitting CNR: ${cnrNumber} on EXISTING page`);

      let capturedJson: any = null;         // JSON from the API (cino, date_next_list, etc.)
      let apiResponseJson: any = null;       // The searchByCNR JSON envelope (errormsg, div_case, etc.)

      const requestLogger = async (req: any) => {
          try {
              const type = req.resourceType();
              if (['xhr', 'fetch'].includes(type)) {
                  console.log(`📤 [XHR-REQ] ${req.method()} ${type.toUpperCase()} → ${req.url().substring(0, 150)}`);
                  const body = req.postData();
                  if (body) console.log(`    Body: ${body.substring(0, 300)}`);
              }
          } catch (e) {}
      };

      const responseLogger = async (response: any) => {
          try {
              const url = response.url();
              const status = response.status();
              const req = response.request();
              const type = req.resourceType();

              if (status >= 400) {
                  console.warn(`📥 [ERR] ${status} ← ${url} (${type})`);
                  if (type === 'xhr' || type === 'fetch' || type === 'script') {
                      try { console.warn(`    Err Body: ${(await response.text()).substring(0, 200)}`); } catch(e){}
                  }
              }

              if (!['xhr', 'fetch'].includes(type)) return;
              
              console.log(`📥 [XHR-RES] ${status} ← ${url.substring(0, 120)}`);
              
              try {
                  const text = await response.text();
                  if (!text || text.trim() === '') return;
                  
                  // Try parse as JSON
                  let json: any = null;
                  try { json = JSON.parse(text); } catch (e) { return; }
                  
                  const keys = Object.keys(json);
                  console.log(`    JSON keys: ${keys.join(', ')}`);
                  
                  // Log each key's content for discovery
                  keys.forEach(k => {
                      const val = String(json[k]);
                      console.log(`      → Key [${k}]: ${val.substring(0, 200).replace(/\s+/g, ' ')}...`);
                  });

                  // If it has errormsg field → it's the searchByCNR response envelope
                  if ('errormsg' in json) {
                      apiResponseJson = json;
                      console.log(`📦 [TN Scraper] searchByCNR envelope captured. errormsg: "${json.errormsg?.substring(0, 80)}"`);
                  } else if (url.includes('searchByCNR')) {
                      // Unexpected structure from searchByCNR (like form reset)
                      console.log(`⚠️ [TN Scraper] Unexpected searchByCNR response structure.`);
                      apiResponseJson = json; 
                  }
                  
                  // If it has raw case data fields (cino, petparty_name, etc.) → direct API data
                  if (json && (json.cino || (json.case_no && json.petparty_name) || json.date_next_list)) {
                      console.log(`🎯 [TN Scraper] Case JSON captured from: ${url}`);
                      capturedJson = json;
                  }
              } catch (e) {}
          } catch (e) {}
      };

      page.on('request', requestLogger);
      page.on('response', responseLogger);

      // 4. Trigger Submission via Portal's internal JS if possible
      console.log('🚀 [TN Scraper] Invoking portal submission...');
      await page.evaluate((btnSel: string) => {
          // Find the CNR search button specifically
          const btn = document.querySelector(btnSel) as any;
          
          // If the button has an onclick, try calling it directly for maximum reliability
          const onclick = btn?.getAttribute('onclick') || '';
          if (onclick.includes('funViewCinoHistory')) {
              console.log('Calling funViewCinoHistory directly');
              (window as any).funViewCinoHistory();
          } else if (typeof (window as any).funViewCinoHistory === 'function') {
              console.log('Calling window.funViewCinoHistory');
              (window as any).funViewCinoHistory();
          } else if (btn) {
              console.log('Clicking button');
              btn.click();
          } else {
              console.warn('No button or function found, fallback to generic click');
          }
      }, submitBtnSelector);

      // 5. Wait for the AJAX response(s) to arrive
      console.log('⏳ [TN Scraper] Waiting for searchByCNR & follow-up AJAX responses...');
      const startTime = Date.now();
      let firstResponseReceivedAt = 0;
      const capturedFragments: string[] = [];
      const capturedJsonObjects: any[] = [];
      let captchaErrorMessage: string | null = null;

      // Response monitoring loop
      while (Date.now() - startTime < 30000) {
          await new Promise(r => setTimeout(r, 500));

          // Check all responses seen by page.on('response')
          if (apiResponseJson) {
              if (firstResponseReceivedAt === 0) firstResponseReceivedAt = Date.now();
              
              // Capture error if present
              if (apiResponseJson.errormsg && apiResponseJson.errormsg.toLowerCase().includes('captcha')) {
                  captchaErrorMessage = apiResponseJson.errormsg.trim();
                  break; // Fast fail on captcha error
              }

              // Collect HTML fragments from any key in any JSON response
              Object.entries(apiResponseJson).forEach(([k, v]) => {
                  if (typeof v === 'string' && v.includes('<')) {
                      if (!capturedFragments.includes(v)) capturedFragments.push(v);
                  }
              });
              
              capturedJsonObjects.push(apiResponseJson);
              apiResponseJson = null; // Clear to catch the next one if it arrives
          }

          if (capturedJson) {
              if (firstResponseReceivedAt === 0) firstResponseReceivedAt = Date.now();
              capturedJsonObjects.push(capturedJson);
              capturedJson = null; // Clear to catch the next one
          }

          // STRAGGLER LOGIC: Once we get the first data, wait at least X seconds more 
          // to catch separate History or Parties AJAX calls.
          if (firstResponseReceivedAt > 0) {
              const timeSinceFirst = Date.now() - firstResponseReceivedAt;
              
              const composite = capturedFragments.join(' ');
              const hasLitigants = composite.includes('Petitioner') || composite.includes('Respondent');
              const hasHistory = composite.includes('History') || composite.includes('Business');
              
              if (hasLitigants && hasHistory) {
                  console.log('✅ [TN Scraper] Full data (Parties + History) captured fast.');
                  break;
              }

              if (timeSinceFirst > 4000) {
                  console.log('⏰ [TN Scraper] Straggler wait window (4s) closed.');
                  break;
              }
          }
      }

      page.off('request', requestLogger);
      page.off('response', responseLogger);

      if (captchaErrorMessage) {
          console.error(`❌ [TN Scraper] Captcha error detected from JSON: "${captchaErrorMessage}"`);
          return { success: false, error: 'Incorrect captcha code entered. Please try again.' };
      }

      const compositeHtml = capturedFragments.join('\n');
      const finalApiData = capturedJsonObjects.reduce((acc, obj) => ({ ...acc, ...obj }), {});
      const normalizedCnr = (cnrNumber || '').toUpperCase();
      const shouldDebug = normalizedCnr === 'TNCH0D0080172023';
      const selectorCounts = {
          '.Petitioner_Advocate_table': (compositeHtml.match(/Petitioner_Advocate_table/g) || []).length,
          '.Respondent_Advocate_table': (compositeHtml.match(/Respondent_Advocate_table/g) || []).length,
          '.case_party_table': (compositeHtml.match(/case_party_table/g) || []).length,
          '.party_table': (compositeHtml.match(/party_table/g) || []).length,
          '#petitioner_table': (compositeHtml.match(/petitioner_table/g) || []).length,
          '#respondent_table': (compositeHtml.match(/respondent_table/g) || []).length
      };

      console.log(`📄 [TN Scraper] Total Fragments: ${capturedFragments.length}, JSON parts: ${capturedJsonObjects.length}, Composite Len: ${compositeHtml.length}`);
      if (shouldDebug) {
          console.log(`[TN Scraper][DEBUG] ${normalizedCnr} raw_html length=${compositeHtml.length}`);
          console.log(`[TN Scraper][DEBUG] ${normalizedCnr} selector_hits=${JSON.stringify(selectorCounts)}`);
          console.log(`[TN Scraper][DEBUG] ${normalizedCnr} api party fields petparty_name="${String(finalApiData?.petparty_name || '').substring(0, 200)}" resparty_name="${String(finalApiData?.resparty_name || '').substring(0, 200)}"`);
      }

      if (compositeHtml.length > 100 || capturedJsonObjects.length > 0) {
          return {
              success: true,
              data: {
                  api_data: finalApiData,
                  raw_html: compositeHtml
              }
          };
      }

      // 6. Nothing usable captured
      console.warn('⚠️ [TN Scraper] No usable data captured. Timeout or session expiry.');
      return {
          success: false,
          error: 'Could not retrieve case data from eCourts. The portal may have changed or the session expired. Please retry.',
      };


    } catch (error: any) {
      console.error('❌ [TN Scraper] Submit Failed:', error);
      return { success: false, error: error.message };
    } finally {
      if (context) await context.close().catch(() => {});
    }
  }
}
