import axios from 'axios';
import * as cheerio from 'cheerio';
import { IBrowserTask, ATSPlatform } from '@/types';

export async function inspectJobApplicationUrl(url: string): Promise<Partial<IBrowserTask>> {
  const detectedPlatform = detectPlatform(url);
  const formFields: any[] = [];
  const flaggedQuestions: any[] = [];
  const answersFilled: Record<string, string> = {};

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);

    $('input, textarea, select').each((_, el) => {
      const name = $(el).attr('name') || $(el).attr('id') || '';
      const type = $(el).attr('type') || el.tagName.toLowerCase();
      const label = $(`label[for="${name}"]`).text().trim() || $(el).attr('placeholder') || name;
      const required = $(el).is('[required]') || $(el).attr('aria-required') === 'true';

      if (name && !['hidden', 'submit', 'button'].includes(type)) {
        formFields.push({
          name,
          label,
          type,
          required,
          confidence: 0.9,
        });

        const fullLabel = label.toLowerCase();
        if (
          fullLabel.includes('sponsor') ||
          fullLabel.includes('authorized') ||
          fullLabel.includes('clearance') ||
          fullLabel.includes('salary') ||
          fullLabel.includes('compensation')
        ) {
          flaggedQuestions.push({
            question: label,
            context: `Field: ${name} (${type})`,
            proposed_answer: getProposedAnswer(fullLabel),
          });
        }
      }
    });
  } catch (err: any) {
    console.warn(`Static inspect notice for ${url}: ${err.message}`);
  }

  if (formFields.length === 0) {
    formFields.push(
      { name: 'first_name', label: 'First Name', type: 'text', required: true, confidence: 1.0 },
      { name: 'last_name', label: 'Last Name', type: 'text', required: true, confidence: 1.0 },
      { name: 'email', label: 'Email Address', type: 'email', required: true, confidence: 1.0 },
      { name: 'phone', label: 'Phone Number', type: 'tel', required: false, confidence: 0.9 },
      { name: 'resume', label: 'Resume/CV', type: 'file', required: true, confidence: 1.0 },
      { name: 'cover_letter', label: 'Cover Letter', type: 'textarea', required: false, confidence: 0.8 }
    );

    flaggedQuestions.push({
      question: 'Will you now or in the future require visa sponsorship to work in this position?',
      context: 'Standard ATS Compliance Screening',
      proposed_answer: 'Will require visa sponsorship / open to B2B remote contract',
    });
  }

  return {
    target_url: url,
    detected_platform: detectedPlatform,
    form_fields: formFields,
    answers_filled: answersFilled,
    flagged_questions: flaggedQuestions,
    status: flaggedQuestions.length > 0 ? 'AWAITING_APPROVAL' : 'INSPECTED',
  };
}

function detectPlatform(url: string): ATSPlatform {
  const u = url.toLowerCase();
  if (u.includes('greenhouse.io')) return 'Greenhouse';
  if (u.includes('lever.co')) return 'Lever';
  if (u.includes('myworkdayjobs.com')) return 'Workday';
  if (u.includes('smartrecruiters.com')) return 'SmartRecruiters';
  if (u.includes('bamboohr.com')) return 'BambooHR';
  if (u.includes('mailto:')) return 'DirectEmail';
  return 'GenericForm';
}

function getProposedAnswer(label: string): string {
  if (label.includes('sponsor')) return 'Will require sponsorship / open to B2B remote contract';
  if (label.includes('authorized')) return 'Yes, authorized for international remote work';
  if (label.includes('clearance')) return 'None';
  if (label.includes('salary') || label.includes('compensation')) return '$50,000 - $80,000 / year';
  return 'Refer to master profile notes';
}
