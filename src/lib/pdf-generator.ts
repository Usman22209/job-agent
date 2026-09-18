import fs from 'fs';
import path from 'path';
// Use pdfkit standalone with virtual embedded fonts
const PDFDocument = require('pdfkit/js/pdfkit.standalone');
import { ITailoredResume } from '@/types';

/**
 * Generates an executive, ATS-compliant PDF resume formatted
 * to match modern executive resume layout and design system.
 */
export async function generateResumePdf(
  resume: ITailoredResume,
  filename: string
): Promise<{ filePath: string; relativeUrl: string }> {
  const publicDir = path.resolve(process.cwd(), 'public/resumes');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const filePath = path.join(publicDir, filename);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 36, bottom: 36, left: 40, right: 40 },
        autoFirstPage: true,
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const contentWidth = 515; // 595.28 - 80 (margins)

      // 1. TOP HEADER: Left-aligned Name
      doc
        .fillColor('#000000')
        .fontSize(22)
        .font('Helvetica-Bold')
        .text(resume.full_name || 'Candidate', 40, 36);

      // Headline / Subtitle
      const headline =
        resume.headline ||
        'Software Engineer';
      doc
        .fontSize(10.5)
        .font('Helvetica-Bold')
        .fillColor('#111827')
        .text(headline);

      // Contact Info Line
      const rawContactLine = resume.contact_line || '';
      const contactLine = rawContactLine.replace(/%Ï/g, '').replace(/\s*•\s*/g, ' | ');
      if (contactLine) {
        doc
          .moveDown(0.2)
          .fontSize(8.5)
          .font('Helvetica')
          .fillColor('#4B5563')
          .text(contactLine);
      }

      doc.moveDown(0.6);

      // 2. PROFESSIONAL SUMMARY
      renderSectionHeader(doc, 'PROFESSIONAL SUMMARY');
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#111827')
        .text(resume.summary, { lineGap: 2.2, align: 'justify' });

      doc.moveDown(0.7);

      // 3. SKILLS SECTIONS
      // If structured skill categories exist, render them with bold prefixes; otherwise format ordered_skills cleanly
      if (resume.skills_categories && resume.skills_categories.length > 0) {
        renderSectionHeader(doc, 'TECHNICAL SKILLS');
        for (const cat of resume.skills_categories) {
          doc
            .fontSize(9)
            .font('Helvetica-Bold')
            .fillColor('#000000')
            .text(`${cat.category}: `, { continued: true })
            .font('Helvetica')
            .fillColor('#1F2937')
            .text(cat.skills, { lineGap: 2 });
        }
        doc.moveDown(0.7);
      } else if (resume.ordered_skills && resume.ordered_skills.length > 0) {
        renderSectionHeader(doc, 'CORE COMPETENCIES & TECHNICAL SKILLS');
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('#1F2937')
          .text(resume.ordered_skills.join(' • '), { lineGap: 2.2 });
        doc.moveDown(0.7);
      }

      // 4. EXPERIENCE SECTION
      renderSectionHeader(doc, 'EXPERIENCE');
      for (const exp of resume.experience) {
        // Page break safety check
        if (doc.y > 700) {
          doc.addPage();
        }

        const startY = doc.y;

        // Left Side: Company + Position
        doc
          .fontSize(9.5)
          .font('Helvetica-Bold')
          .fillColor('#000000')
          .text(exp.company, 40, startY, { continued: true });

        doc
          .font('Helvetica-Oblique')
          .fillColor('#374151')
          .text(`  ${exp.position}`);

        // Right Side: Date Period
        doc
          .fontSize(8.8)
          .font('Helvetica')
          .fillColor('#111827')
          .text(exp.period, 40, startY, { align: 'right', width: contentWidth });

        doc.moveDown(0.25);

        // Bullet Points
        for (const bullet of exp.bullet_points) {
          if (doc.y > 720) {
            doc.addPage();
          }
          const startY = doc.y;
          const cleanBullet = bullet
            .replace(/%Ï/g, '')
            .replace(/^([%Ï\s\u2022\u25CF\u25CB\u25AA\u25FE\u00B7\-*•])+\s*/g, '')
            .trim();

          // Native vector circle - crisp, no font encoding bugs, immune to WinAnsi/UTF-8 garble
          doc.circle(46, startY + 4.5, 1.6).fill('#1F2937');

          doc
            .fontSize(8.8)
            .font('Helvetica')
            .fillColor('#1F2937')
            .text(cleanBullet, 54, startY, {
              width: contentWidth - 14,
              lineGap: 1.8,
              align: 'left',
            });

          doc.x = 40;
          doc.moveDown(0.2);
        }
        doc.moveDown(0.3);
      }

      // 5. KEY PROJECTS SECTION
      if (resume.selected_projects && resume.selected_projects.length > 0) {
        if (doc.y > 680) doc.addPage();
        doc.moveDown(0.4);
        renderSectionHeader(doc, 'KEY PROJECTS');

        for (const proj of resume.selected_projects) {
          if (doc.y > 710) doc.addPage();
          const projY = doc.y;

          doc
            .fontSize(9.5)
            .font('Helvetica-Bold')
            .fillColor('#000000')
            .text(proj.title, 40, projY, { continued: Boolean(proj.url) });

          if (proj.url) {
            doc
              .font('Helvetica')
              .fillColor('#4B5563')
              .text(` | ${proj.url.replace(/^https?:\/\//, '')}`);
          }

          doc.moveDown(0.15);
          const cleanDesc = proj.description
            .replace(/%Ï/g, '')
            .replace(/^([%Ï\s\u2022\u25CF\u25CB\u25AA\u25FE\u00B7\-*•])+\s*/g, '')
            .trim();

          doc
            .fontSize(8.8)
            .font('Helvetica')
            .fillColor('#1F2937')
            .text(cleanDesc, { indent: 6, lineGap: 1.8 });

          doc.moveDown(0.35);
        }
      }

      // 6. EDUCATION
      if (resume.education && resume.education.length > 0) {
        if (doc.y > 700) doc.addPage();
        doc.moveDown(0.4);
        renderSectionHeader(doc, 'EDUCATION');

        for (const edu of resume.education) {
          doc
            .fontSize(9.5)
            .font('Helvetica-Bold')
            .fillColor('#000000')
            .text(edu.degree, { continued: true })
            .font('Helvetica')
            .fillColor('#111827')
            .text(` — ${edu.institution}, ${edu.year}`);

          if (edu.details) {
            doc
              .fontSize(8.5)
              .font('Helvetica')
              .fillColor('#4B5563')
              .text(edu.details);
          }

          doc.moveDown(0.3);
        }
      }

      // 7. AWARDS & HONORS (rendered only if candidate explicitly has awards)
      if (resume.awards && resume.awards.length > 0) {
        if (doc.y > 720) doc.addPage();
        doc.moveDown(0.3);
        renderSectionHeader(doc, 'AWARDS & HONORS');
        for (const award of resume.awards) {
          if (doc.y > 730) doc.addPage();
          const startY = doc.y;
          const cleanAward = award
            .replace(/%Ï/g, '')
            .replace(/^([%Ï\s\u2022\u25CF\u25CB\u25AA\u25FE\u00B7\-*•])+\s*/g, '')
            .trim();

          doc.circle(46, startY + 4.5, 1.6).fill('#1F2937');

          doc
            .fontSize(8.8)
            .font('Helvetica')
            .fillColor('#1F2937')
            .text(cleanAward, 54, startY, {
              width: contentWidth - 14,
              lineGap: 1.5,
              align: 'left',
            });

          doc.x = 40;
          doc.moveDown(0.15);
        }
      }

      doc.end();

      stream.on('finish', () => {
        resolve({
          filePath,
          relativeUrl: `/resumes/${filename}`,
        });
      });

      stream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function renderSectionHeader(doc: any, title: string) {
  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .fillColor('#000000')
    .text(title.toUpperCase(), 40);

  const y = doc.y + 2;
  doc
    .strokeColor('#000000')
    .lineWidth(0.8)
    .moveTo(40, y)
    .lineTo(555, y)
    .stroke();

  doc.y = y + 4;
}
