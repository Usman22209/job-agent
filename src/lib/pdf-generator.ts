import fs from 'fs';
import path from 'path';
// Use pdfkit standalone with virtual embedded fonts
const PDFDocument = require('pdfkit/js/pdfkit.standalone');
import { ITailoredResume } from '@/types';

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
        margins: { top: 40, bottom: 40, left: 45, right: 45 },
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Header: Candidate Name
      doc
        .fillColor('#111827')
        .fontSize(22)
        .font('Helvetica-Bold')
        .text(resume.full_name, { align: 'center' });

      // Contact Info Line
      doc
        .fontSize(9.5)
        .font('Helvetica')
        .fillColor('#4B5563')
        .text(resume.contact_line, { align: 'center' });

      doc.moveDown(0.8);
      renderHorizontalRule(doc);

      // Section: Professional Summary
      doc.moveDown(0.5);
      renderSectionHeader(doc, 'PROFESSIONAL SUMMARY');
      doc
        .fontSize(9.5)
        .font('Helvetica')
        .fillColor('#1F2937')
        .text(resume.summary, { lineGap: 2.5 });

      // Section: Technical Skills
      doc.moveDown(0.8);
      renderSectionHeader(doc, 'TECHNICAL SKILLS');
      const skillsText = resume.ordered_skills.join('  •  ');
      doc
        .fontSize(9.5)
        .font('Helvetica')
        .fillColor('#1F2937')
        .text(skillsText, { lineGap: 3 });

      // Section: Experience
      doc.moveDown(0.8);
      renderSectionHeader(doc, 'WORK EXPERIENCE');
      for (const exp of resume.experience) {
        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#111827')
          .text(`${exp.position}`, { continued: true })
          .font('Helvetica')
          .fillColor('#4B5563')
          .text(`  |  ${exp.company}`, { continued: true })
          .text(`  (${exp.period})`, { align: 'right' });

        doc.moveDown(0.3);
        for (const bullet of exp.bullet_points) {
          doc
            .fontSize(9)
            .font('Helvetica')
            .fillColor('#374151')
            .text(`•  ${bullet}`, { indent: 12, lineGap: 2 });
        }
        doc.moveDown(0.5);
      }

      // Section: Featured Projects
      if (resume.selected_projects && resume.selected_projects.length > 0) {
        doc.moveDown(0.3);
        renderSectionHeader(doc, 'FEATURED PROJECTS');
        for (const proj of resume.selected_projects) {
          doc
            .fontSize(10)
            .font('Helvetica-Bold')
            .fillColor('#111827')
            .text(proj.title, { continued: true })
            .font('Helvetica-Oblique')
            .fillColor('#6366F1')
            .text(` [${proj.technologies.join(', ')}]`);

          doc
            .fontSize(9)
            .font('Helvetica')
            .fillColor('#374151')
            .text(proj.description, { indent: 8, lineGap: 2 });
          doc.moveDown(0.3);
        }
      }

      // Section: Education
      if (resume.education && resume.education.length > 0) {
        doc.moveDown(0.3);
        renderSectionHeader(doc, 'EDUCATION');
        for (const edu of resume.education) {
          doc
            .fontSize(9.5)
            .font('Helvetica-Bold')
            .fillColor('#111827')
            .text(edu.degree, { continued: true })
            .font('Helvetica')
            .fillColor('#4B5563')
            .text(` - ${edu.institution} (${edu.year})`);
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
    .fontSize(10.5)
    .font('Helvetica-Bold')
    .fillColor('#3730A3')
    .text(title.toUpperCase());
  renderHorizontalRule(doc);
  doc.moveDown(0.3);
}

function renderHorizontalRule(doc: any) {
  const y = doc.y;
  doc
    .strokeColor('#E5E7EB')
    .lineWidth(0.8)
    .moveTo(45, y)
    .lineTo(550, y)
    .stroke();
  doc.y = y + 4;
}
