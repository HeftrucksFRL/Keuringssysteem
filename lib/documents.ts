import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from "docx";
import { getFormDefinition } from "@/lib/form-definitions";
import type { InspectionRecord } from "@/lib/domain";

function checklistRows(inspection: InspectionRecord) {
  const form = getFormDefinition(inspection.machineType);
  return form.sections.flatMap((section) => [
    new TableRow({
      children: [
        new TableCell({
          width: { size: 100, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [new TextRun({ text: section.title, bold: true })]
            })
          ]
        })
      ]
    }),
    ...section.items.map(
      (item) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 75, type: WidthType.PERCENTAGE },
              children: [new Paragraph(item.label)]
            }),
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              children: [new Paragraph(inspection.checklist[item.key] ?? "n.v.t.")]
            })
          ]
        })
    )
  ]);
}

export async function generateInspectionDocuments(inspection: InspectionRecord) {
  const baseDir = path.join(
    process.cwd(),
    "generated",
    inspection.inspectionDate.slice(0, 4),
    inspection.inspectionNumber
  );
  await mkdir(baseDir, { recursive: true });

  const pdfPath = path.join(baseDir, `${inspection.inspectionNumber}.pdf`);
  const wordPath = path.join(baseDir, `${inspection.inspectionNumber}.docx`);

  const pdfDocument = await PDFDocument.create();
  const page = pdfDocument.addPage([595, 842]);
  const boldFont = await pdfDocument.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDocument.embedFont(StandardFonts.Helvetica);

  const lines = [
    "Heftrucks Friesland | BMWT keuringsrapport",
    `Keurnummer: ${inspection.inspectionNumber}`,
    `Datum: ${inspection.inspectionDate}`,
    `Klant: ${inspection.customerSnapshot.customer_name ?? ""}`,
    `Machine: ${inspection.machineSnapshot.brand ?? ""} ${inspection.machineSnapshot.model ?? ""}`.trim(),
    "",
    "Bevindingen:",
    inspection.findings || "-",
    "",
    "Aanbevelingen:",
    inspection.recommendations || "-",
    "",
    "Conclusie:",
    inspection.conclusion || "-"
  ];

  let y = 800;
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: 40,
      y,
      size: index === 0 ? 18 : 11,
      font: index === 0 ? boldFont : regularFont,
      color: index === 0 ? rgb(0, 0.37, 0.66) : rgb(0.07, 0.09, 0.13)
    });
    y -= index === 0 ? 28 : 18;
  });

  const pdfBytes = await pdfDocument.save();
  await writeFile(pdfPath, pdfBytes);

  const wordDocument = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "Heftrucks Friesland | BMWT keuringsrapport",
            heading: HeadingLevel.TITLE
          }),
          new Paragraph(`Keurnummer: ${inspection.inspectionNumber}`),
          new Paragraph(`Datum: ${inspection.inspectionDate}`),
          new Paragraph(`Klant: ${inspection.customerSnapshot.customer_name ?? ""}`),
          new Paragraph(
            `Machine: ${(inspection.machineSnapshot.brand ?? "").trim()} ${(inspection.machineSnapshot.model ?? "").trim()}`.trim()
          ),
          new Paragraph(" "),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: checklistRows(inspection)
          }),
          new Paragraph(" "),
          new Paragraph({ text: "Bevindingen", heading: HeadingLevel.HEADING_2 }),
          new Paragraph(inspection.findings || "-"),
          new Paragraph({ text: "Aanbevelingen", heading: HeadingLevel.HEADING_2 }),
          new Paragraph(inspection.recommendations || "-"),
          new Paragraph({ text: "Conclusie", heading: HeadingLevel.HEADING_2 }),
          new Paragraph(inspection.conclusion || "-")
        ]
      }
    ]
  });

  const wordBuffer = await Packer.toBuffer(wordDocument);
  await writeFile(wordPath, wordBuffer);

  return {
    pdfPath,
    wordPath
  };
}
