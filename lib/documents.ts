import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
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

async function firstExistingPath(paths: string[]) {
  for (const candidate of paths) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

async function loadReportAssets() {
  const logoPath = await firstExistingPath([
    path.join(process.cwd(), "Logo Heftrucks.frl.png"),
    path.join(process.cwd(), "public", "logo-heftrucks-frl.png")
  ]);
  const bmwtPath = await firstExistingPath([
    path.join(process.cwd(), "bmwt-logo.jpg"),
    path.join(process.cwd(), "public", "bmwt-logo.jpg")
  ]);

  if (!logoPath || !bmwtPath) {
    throw new Error("Rapportlogo's ontbreken in het project.");
  }

  return {
    logoBytes: await readFile(logoPath),
    bmwtBytes: await readFile(bmwtPath)
  };
}

function summaryRows(inspection: InspectionRecord) {
  return [
    ["Keurnummer", inspection.inspectionNumber],
    ["Datum", inspection.inspectionDate],
    ["Klant", inspection.customerSnapshot.customer_name ?? "-"],
    [
      "Machine",
      `${inspection.machineSnapshot.brand ?? ""} ${inspection.machineSnapshot.model ?? ""}`.trim() ||
        "-"
    ],
    ["Intern nummer", inspection.machineSnapshot.internal_number ?? "-"],
    ["Serienummer", inspection.machineSnapshot.serial_number ?? "-"]
  ];
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
  const { logoBytes, bmwtBytes } = await loadReportAssets();
  const logoImage = await pdfDocument.embedPng(logoBytes);
  const bmwtImage = await pdfDocument.embedJpg(bmwtBytes);

  page.drawImage(logoImage, {
    x: 40,
    y: 770,
    width: 188,
    height: 54
  });

  page.drawImage(bmwtImage, {
    x: 462,
    y: 770,
    width: 88,
    height: 54
  });

  page.drawText("Keuringsrapport", {
    x: 40,
    y: 720,
    size: 22,
    font: boldFont,
    color: rgb(0, 0.37, 0.66)
  });

  page.drawText(getFormDefinition(inspection.machineType).title, {
    x: 40,
    y: 698,
    size: 12,
    font: regularFont,
    color: rgb(0.32, 0.38, 0.45)
  });

  const summaries = summaryRows(inspection);
  let summaryY = 658;
  summaries.forEach(([label, value]) => {
    page.drawText(label, {
      x: 40,
      y: summaryY,
      size: 10,
      font: boldFont,
      color: rgb(0.32, 0.38, 0.45)
    });
    page.drawText(value || "-", {
      x: 165,
      y: summaryY,
      size: 10,
      font: regularFont,
      color: rgb(0.07, 0.09, 0.13)
    });
    summaryY -= 18;
  });

  const writeSection = (title: string, content: string, startY: number) => {
    page.drawText(title, {
      x: 40,
      y: startY,
      size: 12,
      font: boldFont,
      color: rgb(0, 0.37, 0.66)
    });
    page.drawText(content || "-", {
      x: 40,
      y: startY - 18,
      size: 10,
      font: regularFont,
      color: rgb(0.07, 0.09, 0.13),
      maxWidth: 515,
      lineHeight: 14
    });
  };

  writeSection("Bevindingen", inspection.findings, 530);
  writeSection("Aanbevelingen", inspection.recommendations, 448);
  writeSection("Conclusie", inspection.conclusion, 366);

  page.drawText("Checklist", {
    x: 40,
    y: 282,
    size: 12,
    font: boldFont,
    color: rgb(0, 0.37, 0.66)
  });
  page.drawText(
    getFormDefinition(inspection.machineType).sections
      .flatMap((section) =>
        section.items.map(
          (item) => `${section.title} - ${item.label}: ${inspection.checklist[item.key] ?? "n.v.t."}`
        )
      )
      .slice(0, 8)
      .join("\n"),
    {
      x: 40,
      y: 264,
      size: 8.5,
      font: regularFont,
      color: rgb(0.07, 0.09, 0.13),
      maxWidth: 515,
      lineHeight: 11
    }
  );

  page.drawLine({
    start: { x: 40, y: 86 },
    end: { x: 555, y: 86 },
    thickness: 1,
    color: rgb(0, 0.44, 0.75)
  });
  page.drawText("Keurmeester Age Terpstra | (31)653842843 | Info@heftrucks.frl", {
    x: 40,
    y: 54,
    size: 10,
    font: boldFont,
    color: rgb(0, 0.44, 0.75)
  });

  const pdfBytes = await pdfDocument.save();

  const wordDocument = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1417,
              right: 1417,
              bottom: 1417,
              left: 1417
            }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: 72, type: WidthType.PERCENTAGE },
                        borders: {
                          top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                          bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                          left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                          right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
                        },
                        children: [
                          new Paragraph({
                            children: [
                              new ImageRun({
                                data: logoBytes,
                                type: "png",
                                transformation: { width: 190, height: 56 }
                              })
                            ]
                          })
                        ]
                      }),
                      new TableCell({
                        width: { size: 28, type: WidthType.PERCENTAGE },
                        borders: {
                          top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                          bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                          left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                          right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
                        },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                              new ImageRun({
                                data: bmwtBytes,
                                type: "jpg",
                                transformation: { width: 86, height: 54 }
                              })
                            ]
                          })
                        ]
                      })
                    ]
                  })
                ]
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: {
                  top: {
                    color: "0070C0",
                    space: 1,
                    style: BorderStyle.SINGLE,
                    size: 6
                  }
                },
                spacing: {
                  before: 120,
                  after: 120
                }
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Keurmeester Age Terpstra | (31)653842843 | Info@heftrucks.frl",
                    bold: true,
                    color: "0070C0"
                  })
                ]
              })
            ]
          })
        },
        children: [
          new Paragraph({
            text: "Keuringsrapport",
            heading: HeadingLevel.TITLE
          }),
          new Paragraph({
            text: getFormDefinition(inspection.machineType).title,
            spacing: {
              after: 240
            }
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: summaryRows(inspection).map(
              ([label, value]) =>
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 30, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: label, bold: true })]
                        })
                      ]
                    }),
                    new TableCell({
                      width: { size: 70, type: WidthType.PERCENTAGE },
                      children: [new Paragraph(value || "-")]
                    })
                  ]
                })
            )
          }),
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
