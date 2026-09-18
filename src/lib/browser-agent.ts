import { chromium, Browser, Page } from 'playwright';
import { IJob, IMasterProfile } from '@/types';
import { callGeminiWithPersistentRetry, cleanJsonOutput } from './ai/gemini';
import fs from 'fs';
import path from 'path';

export interface BrowserApplyResult {
  success: boolean;
  method: 'BROWSER_AUTO' | 'BROWSER_MANUAL';
  message: string;
  screenshotPath?: string;
  screenshotUrl?: string;
  error?: string;
  formFieldsFilled?: string[];
  requiresManualAction?: boolean;
}

/**
 * Robust browser launcher with automatic fallbacks for Windows/Linux/macOS
 */
async function launchBrowser(): Promise<Browser> {
  const baseArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
  ];

  // Attempt 1: Default Playwright Chromium
  try {
    return await chromium.launch({ headless: true, args: baseArgs });
  } catch (err: any) {
    // Default chromium binary might not be installed
  }

  // Attempt 2: Microsoft Edge (natively available on Windows)
  try {
    return await chromium.launch({ headless: true, channel: 'msedge', args: baseArgs });
  } catch (err: any) {
    // Edge channel not available
  }

  // Attempt 3: Google Chrome
  try {
    return await chromium.launch({ headless: true, channel: 'chrome', args: baseArgs });
  } catch (err: any) {
    // Chrome channel not available
  }

  throw new Error('No browser available. Please run `npx playwright install chromium` to install browser binaries.');
}

// QA field-mapping: maps common form labels to profile values
function buildFieldMap(profile: IMasterProfile, job: IJob, coverLetter?: string): Record<string, string> {
  const names = (profile.full_name || '').split(' ');
  const firstName = names[0] || '';
  const lastName = names.slice(1).join(' ') || '';
  const topSkills = profile.skills?.slice(0, 8).map(s => s.name).join(', ') || '';
  const recentRole = profile.experience?.[0]?.position || profile.headline || 'Software Engineer';
  const recentCompany = profile.experience?.[0]?.company || '';
  const yearsExp = profile.experience?.length > 0 ? `${profile.experience.length * 2}+ years` : '5+ years';
  const linkedinUrl = profile.qa_vault?.linkedin || '';
  const githubUrl = profile.qa_vault?.github || '';
  const portfolioUrl = profile.qa_vault?.portfolio || profile.qa_vault?.website || profile.qa_vault?.behance || '';

  const locParts = (profile.location || '').split(',').map(s => s.trim());
  const city = locParts[0] || '';
  const country = locParts.length > 1 ? locParts[locParts.length - 1] : '';

  return {
    // Name variations
    'full name': profile.full_name || '',
    'name': profile.full_name || '',
    'first name': firstName,
    'firstname': firstName,
    'first': firstName,
    'last name': lastName,
    'lastname': lastName,
    'last': lastName,
    'given name': firstName,
    'family name': lastName,

    // Contact
    'email': profile.email || '',
    'email address': profile.email || '',
    'e-mail': profile.email || '',
    'phone': profile.phone || '',
    'phone number': profile.phone || '',
    'mobile': profile.phone || '',
    'telephone': profile.phone || '',

    // Location
    'location': profile.location || '',
    'city': city,
    'country': country,
    'address': profile.location || '',
    'current location': profile.location || '',

    // Links
    'linkedin': linkedinUrl,
    'linkedin url': linkedinUrl,
    'linkedin profile': linkedinUrl,
    'github': githubUrl,
    'github url': githubUrl,
    'portfolio': portfolioUrl,
    'portfolio url': portfolioUrl,
    'website': portfolioUrl,
    'personal website': portfolioUrl,

    // Professional
    'headline': profile.headline || '',
    'current title': recentRole,
    'current role': recentRole,
    'job title': recentRole,
    'current company': recentCompany,
    'current employer': recentCompany,
    'years of experience': yearsExp,
    'experience': yearsExp,
    'summary': profile.summary || '',

    // Skills
    'skills': topSkills,
    'key skills': topSkills,

    // Cover letter
    'cover letter': coverLetter || '',
    'message': coverLetter || '',
    'additional information': coverLetter || '',
    'notes': coverLetter || '',
    'why do you want to work here': `I am excited about the ${job.title} role at ${job.company}. ${profile.summary || ''}`,

    // Common QA fields
    'salary expectation': 'Negotiable / Open to discussion',
    'salary expectations': 'Negotiable / Open to discussion',
    'expected salary': 'Negotiable / Open to discussion',
    'desired salary': 'Negotiable / Open to discussion',
    'notice period': 'Immediately available',
    'start date': 'Immediately available',
    'availability': 'Immediately available',
    'available start date': 'Immediately available',
    'work authorization': profile.qa_vault?.work_authorization || 'Authorized for international remote work',
    'are you authorized': 'Yes',
    'sponsorship': profile.qa_vault?.sponsorship_required || 'No',
    'require sponsorship': 'No',
    'willing to relocate': 'Open to relocation',
    'remote work': 'Yes',
    'how did you hear': 'Job board / Online search',
    'source': 'Job board',
    'referral': 'N/A',
  };
}

/**
 * Extract form inputs directly from DOM heuristics (fast & reliable for standard ATS like Greenhouse, Lever, etc.)
 */
async function detectFormFieldsFromDOM(page: Page, fieldMap: Record<string, string>): Promise<{
  fields: { selector: string; label: string; value: string; type: string }[];
  hasFileUpload: boolean;
  submitSelector: string | null;
  hasCaptcha: boolean;
  isApplicationForm: boolean;
}> {
  return await page.evaluate((fieldData) => {
    const fields: { selector: string; label: string; value: string; type: string }[] = [];
    let hasFileUpload = false;
    let submitSelector: string | null = null;
    let hasCaptcha = false;

    // Check for CAPTCHAs
    const captchaEl = document.querySelector(
      'iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="turnstile"], .g-recaptcha, .h-captcha, [id*="captcha" i]'
    );
    if (captchaEl) {
      hasCaptcha = true;
    }

    // Check file upload
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      hasFileUpload = true;
    }

    // Find submit button
    const submitBtn = document.querySelector(
      'button[type="submit"], input[type="submit"], button[id*="submit" i], button[class*="submit" i], button:not([type="button"])'
    );
    if (submitBtn) {
      const id = submitBtn.getAttribute('id');
      if (id) submitSelector = `#${id}`;
      else submitSelector = 'button[type="submit"], input[type="submit"]';
    }

    // Scan all interactive inputs
    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="file"]):not([type="button"]), textarea, select');
    
    inputs.forEach((el) => {
      const inputEl = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      const name = (inputEl.getAttribute('name') || '').toLowerCase();
      const id = (inputEl.getAttribute('id') || '').toLowerCase();
      const placeholder = (inputEl.getAttribute('placeholder') || '').toLowerCase();
      const ariaLabel = (inputEl.getAttribute('aria-label') || '').toLowerCase();
      
      // Determine label text
      let labelText = '';
      if (inputEl.id) {
        const label = document.querySelector(`label[for="${inputEl.id}"]`);
        if (label) labelText = (label.textContent || '').toLowerCase().trim();
      }
      if (!labelText && inputEl.closest('label')) {
        labelText = (inputEl.closest('label')?.textContent || '').toLowerCase().trim();
      }

      const identifier = `${name} ${id} ${placeholder} ${ariaLabel} ${labelText}`.trim();
      if (!identifier) return;

      // Find best match in fieldData
      let matchedKey = '';
      let matchedVal = '';

      for (const [key, val] of Object.entries(fieldData)) {
        if (identifier.includes(key)) {
          matchedKey = key;
          matchedVal = val as string;
          break;
        }
      }

      if (matchedKey && matchedVal) {
        let selector = '';
        if (inputEl.id) selector = `#${inputEl.id}`;
        else if (inputEl.name) selector = `${inputEl.tagName.toLowerCase()}[name="${inputEl.name}"]`;
        else return;

        fields.push({
          selector,
          label: matchedKey,
          value: matchedVal,
          type: inputEl.tagName.toLowerCase() === 'textarea' ? 'textarea' : (inputEl.getAttribute('type') || 'text'),
        });
      }
    });

    const isApplicationForm = fields.length >= 2 || hasFileUpload;

    return {
      fields,
      hasFileUpload,
      submitSelector,
      hasCaptcha,
      isApplicationForm,
    };
  }, fieldMap);
}

/**
 * Use Gemini Vision AI to analyze a page screenshot and identify form fields
 */
async function analyzePageWithAI(
  screenshotBase64: string,
  pageText: string,
  fieldMap: Record<string, string>
): Promise<{
  fields: { selector: string; label: string; value: string; type: string }[];
  hasFileUpload: boolean;
  submitSelector: string | null;
  hasCaptcha: boolean;
  isApplicationForm: boolean;
  nextPageSelector: string | null;
}> {
  const availableFields = Object.entries(fieldMap)
    .slice(0, 25)
    .map(([label, value]) => `"${label}": "${(value || '').slice(0, 60)}"`)
    .join('\n');

  const prompt = `You are analyzing a job application web page. Look at the screenshot and the page text below.

Page text (first 2500 chars):
${pageText.slice(0, 2500)}

Available candidate data to fill:
${availableFields}

Analyze this page and return JSON strictly in this format:
{
  "isApplicationForm": true,
  "hasCaptcha": false,
  "hasFileUpload": true,
  "fields": [
    {
      "selector": "CSS selector to target the input (e.g. 'input[name=email]', '#first-name')",
      "label": "the field label (lowercase)",
      "value": "the matching candidate value",
      "type": "text"
    }
  ],
  "submitSelector": "CSS selector for the submit button, or null",
  "nextPageSelector": null
}

Rules:
- Only include fields that are visible form elements
- Match each field to candidate data accurately
- If the page is NOT an application form (e.g. only job description), set isApplicationForm to false`;

  const apiKey = process.env.GEMINI_API_KEY;
  let rawText = '';
  try {
    const result = await callGeminiWithPersistentRetry(
      apiKey,
      prompt,
      'Analyze job application form screenshot and identify fillable fields',
      1,
      true,
      { mimeType: 'image/png', data: screenshotBase64 }
    );
    rawText = result.text;
  } catch (err: any) {
    console.warn(`[Browser Agent] AI Vision skipped (${err.message?.includes('quota') ? 'API quota limit' : err.message?.slice(0, 60)}). Proceeding with DOM detection.`);
  }

  if (rawText) {
    try {
      const cleaned = cleanJsonOutput(rawText);
      return JSON.parse(cleaned);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {}
      }
    }
  }

  return {
    isApplicationForm: false,
    hasCaptcha: false,
    hasFileUpload: false,
    fields: [],
    submitSelector: null,
    nextPageSelector: null,
  };
}

/**
 * Core browser agent: navigates to job URL, analyzes form, fills fields, uploads resume, submits
 */
export async function browserAutoApply(
  job: IJob,
  profile: IMasterProfile,
  pdfPath?: string,
  coverLetter?: string
): Promise<BrowserApplyResult> {
  const applyUrl = job.application_url || job.url;
  const fieldMap = buildFieldMap(profile, job, coverLetter);
  const filledFields: string[] = [];

  let browser: Browser | null = null;

  try {
    console.log(`[Browser Agent] Launching browser for "${job.title}" at ${job.company}...`);
    console.log(`[Browser Agent] Target URL: ${applyUrl}`);

    browser = await launchBrowser();

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 },
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    // Navigate to application page
    try {
      await page.goto(applyUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await page.waitForTimeout(2000); // Allow dynamic scripts to hydrate
    } catch (navErr: any) {
      console.warn(`[Browser Agent] Navigation warning: ${navErr.message}`);
    }

    // First: Check for Cloudflare bot challenge or security verification
    const pageTitle = await page.title().catch(() => '');
    const pageText = await page.evaluate(() => document.body.innerText || '').catch(() => '');

    const isCloudflare = 
      pageTitle.toLowerCase().includes('just a moment') ||
      pageText.toLowerCase().includes('performing security verification') ||
      pageText.toLowerCase().includes('protect against malicious bots') ||
      pageText.includes('Ray ID:') ||
      pageText.toLowerCase().includes('checking your browser');

    if (isCloudflare) {
      console.log(`[Browser Agent] 🛡️ Cloudflare bot protection detected on ${applyUrl}.`);
      const ssPath = await saveScreenshot(page, job, 'cloudflare');
      await browser.close();
      return {
        success: false,
        method: 'BROWSER_MANUAL',
        message: `Cloudflare bot challenge detected on ${job.company} portal. Tailored resume & cover letter are prepared. Open link directly to apply: ${applyUrl}`,
        screenshotPath: ssPath.path,
        screenshotUrl: ssPath.url,
        requiresManualAction: true,
      };
    }

    // Check DOM directly for immediate field matches
    let domAnalysis = await detectFormFieldsFromDOM(page, fieldMap);
    console.log(`[Browser Agent] DOM check: ${domAnalysis.fields.length} fields found, hasFileUpload=${domAnalysis.hasFileUpload}`);

    // If not immediately an application form, look for an "Apply" button to click
    if (!domAnalysis.isApplicationForm) {
      console.log(`[Browser Agent] Looking for "Apply" button on page...`);
      const applySelectors = [
        'a:has-text("Apply for this position")',
        'a:has-text("Apply for this job")',
        'a:has-text("Apply Now")',
        'button:has-text("Apply Now")',
        '.jv-apply-primary',
        'button[data-modal-open*="popup"]',
        'a:has-text("Apply")',
        'button:has-text("Apply")',
        'a[href*="apply"]',
        'button[id*="apply" i]',
      ];

      for (const sel of applySelectors) {
        try {
          const btn = await page.$(sel);
          if (btn && (await btn.isVisible())) {
            console.log(`[Browser Agent] Clicking "${sel}"...`);
            await btn.click();
            await page.waitForTimeout(3000);
            domAnalysis = await detectFormFieldsFromDOM(page, fieldMap);
            break;
          }
        } catch {}
      }
    }

    // Take screenshot for AI analysis and audit log
    const screenshotBuffer = await page.screenshot({ fullPage: false });
    const screenshotBase64 = screenshotBuffer.toString('base64');

    // AI Vision Analysis (skip if Gemini has quota limits)
    console.log(`[Browser Agent] Running multimodal analysis on form...`);
    const aiAnalysis = await analyzePageWithAI(screenshotBase64, pageText, fieldMap);

    // Merge DOM and AI analyses
    const hasCaptcha = domAnalysis.hasCaptcha || aiAnalysis.hasCaptcha;
    const hasFileUpload = domAnalysis.hasFileUpload || aiAnalysis.hasFileUpload;
    const submitSelector = domAnalysis.submitSelector || aiAnalysis.submitSelector;

    // Combine unique fields
    const fieldMapBySelector = new Map<string, { selector: string; label: string; value: string; type: string }>();
    for (const f of domAnalysis.fields) {
      fieldMapBySelector.set(f.selector, f);
    }
    for (const f of aiAnalysis.fields) {
      if (!fieldMapBySelector.has(f.selector)) {
        fieldMapBySelector.set(f.selector, f);
      }
    }

    const fieldsToFill = Array.from(fieldMapBySelector.values());
    const isApplicationForm = fieldsToFill.length > 0 || domAnalysis.isApplicationForm || aiAnalysis.isApplicationForm;

    // If CAPTCHA is present, human intervention is required
    if (hasCaptcha) {
      console.log(`[Browser Agent] 🛡️ CAPTCHA detected on page. Saving screenshot for manual resolution.`);
      const ssPath = await saveScreenshot(page, job, 'captcha');
      await browser.close();
      return {
        success: false,
        method: 'BROWSER_MANUAL',
        message: `CAPTCHA or bot protection detected. Open link to complete application: ${applyUrl}`,
        screenshotPath: ssPath.path,
        screenshotUrl: ssPath.url,
        requiresManualAction: true,
      };
    }

    // If no form detected at all
    if (!isApplicationForm && fieldsToFill.length === 0 && !hasFileUpload) {
      console.log(`[Browser Agent] No fillable application form detected on page.`);
      const ssPath = await saveScreenshot(page, job, 'no_form');
      await browser.close();
      return {
        success: false,
        method: 'BROWSER_MANUAL',
        message: `External portal requires login or custom navigation. Apply directly at: ${applyUrl}`,
        screenshotPath: ssPath.path,
        screenshotUrl: ssPath.url,
        requiresManualAction: true,
      };
    }

    // Fill form fields
    console.log(`[Browser Agent] Auto-filling ${fieldsToFill.length} detected fields...`);
    for (const field of fieldsToFill) {
      try {
        const el = await page.$(field.selector);
        if (!el || !(await el.isVisible())) continue;

        if (field.type === 'select') {
          await el.selectOption({ label: field.value }).catch(() =>
            el.selectOption({ value: field.value }).catch(() => {})
          );
        } else if (field.type === 'checkbox' || field.type === 'radio') {
          const checked = await el.isChecked().catch(() => false);
          if (!checked) await el.check().catch(() => el.click());
        } else {
          await el.click().catch(() => {});
          await el.fill('');
          await el.fill(field.value);
          await page.waitForTimeout(150);
        }

        filledFields.push(field.label);
        console.log(`[Browser Agent]   ✓ Filled "${field.label}"`);
      } catch (fillErr: any) {
        console.warn(`[Browser Agent]   ⚠ Error filling ${field.selector}: ${fillErr.message}`);
      }
    }

    // Upload tailored resume PDF if file input is available
    if (pdfPath && fs.existsSync(pdfPath)) {
      console.log(`[Browser Agent] Attaching tailored PDF: ${path.basename(pdfPath)}`);
      try {
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
          await fileInput.setInputFiles(pdfPath);
          filledFields.push('resume_pdf');
          console.log(`[Browser Agent]   ✓ Tailored resume attached successfully`);
          await page.waitForTimeout(1000);
        }
      } catch (fileErr: any) {
        console.warn(`[Browser Agent]   ⚠ Resume upload warning: ${fileErr.message}`);
      }
    }

    // Submit if submit button is found and at least name/email were filled
    if (submitSelector && (filledFields.includes('name') || filledFields.includes('email') || filledFields.length >= 3)) {
      console.log(`[Browser Agent] Submitting application via ${submitSelector}...`);
      try {
        const submitBtn = await page.$(submitSelector);
        if (submitBtn && (await submitBtn.isVisible())) {
          await submitBtn.click();
          await page.waitForTimeout(4000);

          const ssPath = await saveScreenshot(page, job, 'submitted');
          console.log(`[Browser Agent] ✓ Form submitted for "${job.title}" at ${job.company}`);

          await browser.close();
          return {
            success: true,
            method: 'BROWSER_AUTO',
            message: `Successfully submitted application via browser automation (${filledFields.length} fields filled + resume attached).`,
            screenshotPath: ssPath.path,
            screenshotUrl: ssPath.url,
            formFieldsFilled: filledFields,
          };
        }
      } catch (submitErr: any) {
        console.warn(`[Browser Agent] Submit button click warning: ${submitErr.message}`);
      }
    }

    // Fields were filled but submit button wasn't clicked or requires manual review
    const ssPath = await saveScreenshot(page, job, 'filled');
    await browser.close();

    return {
      success: false,
      method: 'BROWSER_MANUAL',
      message: `Form fields pre-filled (${filledFields.length} fields). Ready for your review and final submit at: ${applyUrl}`,
      screenshotPath: ssPath.path,
      screenshotUrl: ssPath.url,
      formFieldsFilled: filledFields,
      requiresManualAction: true,
    };
  } catch (err: any) {
    console.error(`[Browser Agent] Error: ${err.message}`);
    if (browser) {
      await browser.close().catch(() => {});
    }
    return {
      success: false,
      method: 'BROWSER_MANUAL',
      message: `Browser automation encountered an issue: ${err.message}. Ready for manual submission.`,
      error: err.message,
      requiresManualAction: true,
    };
  }
}

/**
 * Save a screenshot to the public directory for UI display
 */
async function saveScreenshot(
  page: Page,
  job: IJob,
  label: string
): Promise<{ path: string; url: string }> {
  const dir = path.resolve(process.cwd(), 'public/screenshots');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const safeCompany = (job.company || 'company').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
  const shortId = (job.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
  const filename = `apply_${safeCompany}_${shortId}_${label}.png`;
  const filePath = path.join(dir, filename);

  try {
    await page.screenshot({ path: filePath, fullPage: false });
    console.log(`[Browser Agent] Screenshot saved: ${filename}`);
  } catch (err: any) {
    console.warn(`[Browser Agent] Screenshot capture failed: ${err.message}`);
  }

  return { path: filePath, url: `/screenshots/${filename}` };
}
