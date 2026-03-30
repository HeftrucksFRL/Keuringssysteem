import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  Document,
  HeadingLevel,
  ImageRun,
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

interface GenerateDocumentsOptions {
  persistToDisk?: boolean;
}

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

export async function generateInspectionDocuments(
  inspection: InspectionRecord,
  options: GenerateDocumentsOptions = {}
) {
  const pdfDocument = await PDFDocument.create();
  const page = pdfDocument.addPage([595, 842]);
  const boldFont = await pdfDocument.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDocument.embedFont(StandardFonts.Helvetica);
  const logoBytes = await readFile(path.join(process.cwd(), "public", "logo-heftrucks-frl.png"));
  const bmwtBytes = await readFile(path.join(process.cwd(), "public", "bmwt-logo.jpg"));
  const logoImage = await pdfDocument.embedPng(logoBytes);
  const bmwtImage = await pdfDocument.embedJpg(bmwtBytes);

  page.drawImage(logoImage, {
    x: 40,
    y: 780,
    width: 150,
    height: 44
  });

  page.drawImage(bmwtImage, {
    x: 470,
    y: 780,
    width: 76,
    height: 44
  });

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

  let y = 742;
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

  page.drawLine({
    start: { x: 40, y: 86 },
    end: { x: 555, y: 86 },
    thickness: 1,
    color: rgb(0.78, 0.84, 0.89)
  });
  page.drawText("Keurmeester A. Terpstra", {
    x: 40,
    y: 66,
    size: 10,
    font: regularFont,
    color: rgb(0.32, 0.38, 0.45)
  });
  page.drawText("Heftrucks.frl | info@heftrucks.frl | (31)6 53842843", {
    x: 40,
    y: 50,
    size: 10,
    font: regularFont,
    color: rgb(0.32, 0.38, 0.45)
  });

  const pdfBytes = await pdfDocument.save();

  const wordDocument = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new ImageRun({
                data: logoBytes,
                type: "png",
                transformation: { width: 170, height: 48 }
              }),
              new TextRun("   "),
              new ImageRun({
                data: bmwtBytes,
                type: "jpg",
                transformation: { width: 80, height: 46 }
              })
            ]
          }),
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
          new Paragraph(inspection.conclusion || "-"),
          new Paragraph(" "),
          new Paragraph("Keurmeester A. Terpstra"),
          new Paragraph("Heftrucks.frl | info@heftrucks.frl | (31)6 53842843")
        ]
      }
    ]
  });

  const wordBuffer = await Packer.toBuffer(wordDocument);

  let pdfPath: string | undefined;
  let wordPath: string | undefined;

  if (options.persistToDisk) {
    const baseDir = path.join(
      process.cwd(),
      "generated",
      inspection.inspectionDate.slice(0, 4),
      inspection.inspectionNumber
    );
    await mkdir(baseDir, { recursive: true });
    pdfPath = path.join(baseDir, `${inspection.inspectionNumber}.pdf`);
    wordPath = path.join(baseDir, `${inspection.inspectionNumber}.docx`);
    await writeFile(pdfPath, pdfBytes);
    await writeFile(wordPath, wordBuffer);
  }

  return {
    pdfBuffer: Buffer.from(pdfBytes),
    wordBuffer,
    pdfFileName: `${inspection.inspectionNumber}.pdf`,
    wordFileName: `${inspection.inspectionNumber}.docx`,
    pdfPath,
    wordPath
  };
}
