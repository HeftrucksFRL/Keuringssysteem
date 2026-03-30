import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import { PDFDocument, PDFEmbeddedPage, PDFPage, StandardFonts, rgb } from "pdf-lib";
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

async function loadWordTemplatePath() {
  return firstExistingPath([path.join(process.cwd(), "Sjabloon keuringsformulier.docx")]);
}

async function loadPdfTemplatePath() {
  return firstExistingPath([path.join(process.cwd(), "Sjabloon keuringsformulier.pdf")]);
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildWordParagraph(text: string, options?: { bold?: boolean; size?: number }) {
  const safeText = escapeXml(text || "");
  const runProps = [
    options?.bold ? "<w:b/><w:bCs/>" : "",
    options?.size ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>` : ""
  ].join("");

  return `<w:p><w:r><w:rPr>${runProps}</w:rPr><w:t xml:space="preserve">${
    safeText || " "
  }</w:t></w:r></w:p>`;
}

function buildWordSectionTitle(text: string) {
  return `<w:p><w:pPr><w:spacing w:before="180" w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:bCs/><w:color w:val="0070C0"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>${escapeXml(
    text
  )}</w:t></w:r></w:p>`;
}

function buildWordBodyTable(rows: Array<[string, string]>) {
  const borderXml =
    '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9E6F2"/><w:left w:val="single" w:sz="4" w:color="D9E6F2"/><w:bottom w:val="single" w:sz="4" w:color="D9E6F2"/><w:right w:val="single" w:sz="4" w:color="D9E6F2"/><w:insideH w:val="single" w:sz="4" w:color="D9E6F2"/><w:insideV w:val="single" w:sz="4" w:color="D9E6F2"/></w:tblBorders>';

  const rowXml = rows
    .map(
      ([label, value]) => `<w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="2600" w:type="dxa"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>${escapeXml(label)}</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="6800" w:type="dxa"/></w:tcPr>
          <w:p><w:r><w:t xml:space="preserve">${escapeXml(value || "-")}</w:t></w:r></w:p>
        </w:tc>
      </w:tr>`
    )
    .join("");

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="10000" w:type="dxa"/>
      ${borderXml}
      <w:tblCellMar>
        <w:top w:w="100" w:type="dxa"/>
        <w:left w:w="120" w:type="dxa"/>
        <w:bottom w:w="100" w:type="dxa"/>
        <w:right w:w="120" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tblGrid>
      <w:gridCol w:w="2600"/>
      <w:gridCol w:w="6800"/>
    </w:tblGrid>
    ${rowXml}
  </w:tbl>`;
}

function buildWordMultilineContent(text: string) {
  const lines = (text || "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return buildWordParagraph("-");
  }

  return lines.map((line) => buildWordParagraph(line)).join("");
}

function buildWordChecklistTable(inspection: InspectionRecord) {
  const form = getFormDefinition(inspection.machineType);
  const rows: Array<[string, string]> = form.sections.flatMap((section) => [
    [section.title, ""] as [string, string],
    ...section.items.map(
      (item) => [item.label, inspection.checklist[item.key] ?? "n.v.t."] as [string, string]
    )
  ]);

  const borderXml =
    '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9E6F2"/><w:left w:val="single" w:sz="4" w:color="D9E6F2"/><w:bottom w:val="single" w:sz="4" w:color="D9E6F2"/><w:right w:val="single" w:sz="4" w:color="D9E6F2"/><w:insideH w:val="single" w:sz="4" w:color="D9E6F2"/><w:insideV w:val="single" w:sz="4" w:color="D9E6F2"/></w:tblBorders>';

  const rowXml = rows
    .map(([label, value]) => {
      if (!value) {
        return `<w:tr>
          <w:tc>
            <w:tcPr><w:gridSpan w:val="2"/></w:tcPr>
            <w:p><w:r><w:rPr><w:b/><w:bCs/><w:color w:val="0070C0"/></w:rPr><w:t>${escapeXml(
              label
            )}</w:t></w:r></w:p>
          </w:tc>
        </w:tr>`;
      }

      return `<w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="7600" w:type="dxa"/></w:tcPr>
          <w:p><w:r><w:t xml:space="preserve">${escapeXml(label)}</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="1800" w:type="dxa"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>${escapeXml(
            value
          )}</w:t></w:r></w:p>
        </w:tc>
      </w:tr>`;
    })
    .join("");

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="10000" w:type="dxa"/>
      ${borderXml}
      <w:tblCellMar>
        <w:top w:w="100" w:type="dxa"/>
        <w:left w:w="120" w:type="dxa"/>
        <w:bottom w:w="100" w:type="dxa"/>
        <w:right w:w="120" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tblGrid>
      <w:gridCol w:w="7600"/>
      <w:gridCol w:w="1800"/>
    </w:tblGrid>
    ${rowXml}
  </w:tbl>`;
}

async function generateWordFromTemplate(inspection: InspectionRecord) {
  const templatePath = await loadWordTemplatePath();
  if (!templatePath) {
    throw new Error("Sjabloon keuringsformulier.docx ontbreekt in de projectmap.");
  }

  const zip = new AdmZip(templatePath);
  const documentEntry = zip.getEntry("word/document.xml");
  if (!documentEntry) {
    throw new Error("Het Word-sjabloon bevat geen document.xml.");
  }

  const documentXml = zip.readAsText(documentEntry);
  const sectionMatch = documentXml.match(/<w:sectPr[\s\S]*<\/w:sectPr>/);
  if (!sectionMatch) {
    throw new Error("Het Word-sjabloon bevat geen sectiegegevens.");
  }

  const bodyXml = [
    buildWordSectionTitle("Keuringsrapport"),
    buildWordParagraph(getFormDefinition(inspection.machineType).title, { size: 24 }),
    buildWordParagraph(""),
    buildWordBodyTable(summaryRows(inspection)),
    buildWordSectionTitle("Checklist"),
    buildWordChecklistTable(inspection),
    buildWordSectionTitle("Bevindingen"),
    buildWordMultilineContent(inspection.findings),
    buildWordSectionTitle("Aanbevelingen"),
    buildWordMultilineContent(inspection.recommendations),
    buildWordSectionTitle("Conclusie"),
    buildWordMultilineContent(inspection.conclusion)
  ].join("");

  const updatedDocumentXml = documentXml.replace(
    /<w:body>[\s\S]*<\/w:body>/,
    `<w:body>${bodyXml}${sectionMatch[0]}</w:body>`
  );

  zip.updateFile("word/document.xml", Buffer.from(updatedDocumentXml, "utf8"));
  return zip.toBuffer();
}

function inspectionStatusLabel(inspection: InspectionRecord) {
  if (inspection.status === "rejected") {
    return "Afgekeurd";
  }

  if (inspection.status === "draft") {
    return "Keuring in uitvoering";
  }

  if (inspection.status === "completed") {
    return "Afgerond";
  }

  return "Goedgekeurd";
}

function summaryRows(inspection: InspectionRecord): Array<[string, string]> {
  return [
    ["Keurnummer", inspection.inspectionNumber],
    ["Datum", inspection.inspectionDate],
    ["Status", inspectionStatusLabel(inspection)],
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

export async function generateInspectionDocuments(
  inspection: InspectionRecord,
  options: GenerateDocumentsOptions = {}
) {
  const pdfTemplatePath = await loadPdfTemplatePath();
  const pdfDocument = await PDFDocument.create();
  const boldFont = await pdfDocument.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDocument.embedFont(StandardFonts.Helvetica);
  const { logoBytes, bmwtBytes } = await loadReportAssets();
  const reportBaseName = `Keuringsrapport ${inspection.inspectionNumber}`;
  const brandBlue = rgb(0, 0.44, 0.75);
  const softBlue = rgb(0.93, 0.96, 0.99);
  const borderBlue = rgb(0.85, 0.9, 0.95);
  const darkText = rgb(0.07, 0.09, 0.13);
  const mutedText = rgb(0.32, 0.38, 0.45);
  const fallbackLogoImage = await pdfDocument.embedPng(logoBytes);
  const fallbackBmwtImage = await pdfDocument.embedJpg(bmwtBytes);
  const form = getFormDefinition(inspection.machineType);
  const pageWidth = 595.32;
  const pageHeight = 841.92;
  const contentLeft = 56;
  const contentRight = 539;
  const contentWidth = contentRight - contentLeft;
  const contentTop = 664;
  const contentBottom = 110;
  const sectionGap = 14;

  function wrapText(text: string, fontSize: number, maxWidth: number) {
    const value = (text || "-").replace(/\r/g, "");
    const paragraphs = value.split("\n");
    const lines: string[] = [];

    paragraphs.forEach((paragraph) => {
      if (!paragraph.trim()) {
        lines.push("");
        return;
      }

      const words = paragraph.split(/\s+/);
      let currentLine = "";

      words.forEach((word) => {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        if (regularFont.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
          currentLine = candidate;
        } else {
          if (currentLine) {
            lines.push(currentLine);
          }
          currentLine = word;
        }
      });

      if (currentLine) {
        lines.push(currentLine);
      }
    });

    return lines.length > 0 ? lines : ["-"];
  }

  let templatePage: PDFEmbeddedPage | null = null;
  if (pdfTemplatePath) {
    const templateBytes = await readFile(pdfTemplatePath);
    [templatePage] = await pdfDocument.embedPdf(templateBytes, [0]);
  }

  function drawPageFrame(page: PDFPage) {
    if (templatePage) {
      page.drawPage(templatePage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight
      });
      return;
    }

    page.drawImage(fallbackLogoImage, {
      x: 42,
      y: 760,
      width: 188,
      height: 54
    });
    page.drawImage(fallbackBmwtImage, {
      x: 462,
      y: 760,
      width: 88,
      height: 54
    });
    page.drawLine({
      start: { x: 40, y: 86 },
      end: { x: 555, y: 86 },
      thickness: 1,
      color: brandBlue
    });
    page.drawText("Keurmeester A. Terpstra", {
      x: 40,
      y: 66,
      size: 10,
      font: regularFont,
      color: mutedText
    });
    page.drawText("Heftrucks.frl | info@heftrucks.frl | (31)6 53842843", {
      x: 40,
      y: 50,
      size: 10,
      font: regularFont,
      color: mutedText
    });
  }

  let page = pdfDocument.addPage([pageWidth, pageHeight]);
  drawPageFrame(page);
  let cursorY = contentTop;

  function nextPage() {
    page = pdfDocument.addPage([pageWidth, pageHeight]);
    drawPageFrame(page);
    cursorY = contentTop;
  }

  function ensureSpace(height: number) {
    if (cursorY - height < contentBottom) {
      nextPage();
    }
  }

  function drawCardShell(height: number, options?: { headerTitle?: string }) {
    ensureSpace(height);

    page.drawRectangle({
      x: contentLeft,
      y: cursorY - height,
      width: contentWidth,
      height,
      color: rgb(1, 1, 1),
      opacity: 0.95,
      borderColor: borderBlue,
      borderWidth: 1
    });

    if (options?.headerTitle) {
      page.drawRectangle({
        x: contentLeft,
        y: cursorY - 24,
        width: contentWidth,
        height: 24,
        color: softBlue
      });
      page.drawText(options.headerTitle, {
        x: contentLeft + 14,
        y: cursorY - 16,
        size: 11,
        font: boldFont,
        color: brandBlue
      });
    }
  }

  function drawSectionCard(title: string, content: string) {
    const lines = wrapText(content, 10, contentWidth - 28);
    const textHeight = Math.max(lines.length * 14, 16);
    const sectionHeight = 42 + textHeight + 16;
    drawCardShell(sectionHeight, { headerTitle: title });

    let textY = cursorY - 42;
    lines.forEach((line) => {
      page.drawText(line || " ", {
        x: contentLeft + 14,
        y: textY,
        size: 10,
        font: regularFont,
        color: darkText,
        maxWidth: contentWidth - 28
      });
      textY -= 14;
    });

    cursorY -= sectionHeight + sectionGap;
  }

  function drawMetaCard() {
    const cardHeight = 86;
    drawCardShell(cardHeight);
    page.drawText("Keuringsrapport", {
      x: contentLeft + 14,
      y: cursorY - 18,
      size: 17,
      font: boldFont,
      color: brandBlue
    });
    page.drawText(form.title, {
      x: contentLeft + 14,
      y: cursorY - 38,
      size: 11,
      font: regularFont,
      color: mutedText
    });

    const metaItems = [
      ["Keurnummer", inspection.inspectionNumber],
      ["Datum", inspection.inspectionDate],
      ["Status", inspectionStatusLabel(inspection)]
    ] as const;
    const columnWidth = 108;
    metaItems.forEach(([label, value], index) => {
      const x = contentRight - 14 - columnWidth * (metaItems.length - index);
      page.drawText(label, {
        x,
        y: cursorY - 54,
        size: 8.5,
        font: boldFont,
        color: mutedText
      });
      page.drawText(value, {
        x,
        y: cursorY - 70,
        size: 10,
        font: regularFont,
        color: darkText,
        maxWidth: columnWidth - 8
      });
    });

    cursorY -= cardHeight + sectionGap;
  }

  function drawTwoColumnInfoCard() {
    const infoRows: Array<[[string, string], [string, string]]> = [
      [
        ["Klant", inspection.customerSnapshot.customer_name ?? "-"],
        [
          "Machine",
          `${inspection.machineSnapshot.brand ?? ""} ${inspection.machineSnapshot.model ?? ""}`.trim() ||
            "-"
        ]
      ],
      [
        ["Intern nummer", inspection.machineSnapshot.internal_number ?? "-"],
        ["Serienummer", inspection.machineSnapshot.serial_number ?? "-"]
      ]
    ];

    const columnWidth = (contentWidth - 42) / 2;
    const rightColumnX = contentLeft + 14 + columnWidth + 14;
    const rowHeights = infoRows.map(([leftEntry, rightEntry]) => {
      const leftLines = wrapText(leftEntry[1], 10, columnWidth);
      const rightLines = wrapText(rightEntry[1], 10, columnWidth);
      return Math.max(leftLines.length, rightLines.length) * 14 + 28;
    });
    const cardHeight = 32 + rowHeights.reduce((sum, height) => sum + height, 0);

    drawCardShell(cardHeight, { headerTitle: "Klant en machine" });

    let rowTop = cursorY - 38;
    infoRows.forEach(([leftEntry, rightEntry], index) => {
      const rowHeight = rowHeights[index];
      if (index > 0) {
        page.drawLine({
          start: { x: contentLeft + 14, y: rowTop + 10 },
          end: { x: contentRight - 14, y: rowTop + 10 },
          thickness: 1,
          color: borderBlue
        });
      }

      const drawEntry = (x: number, label: string, value: string) => {
        page.drawText(label, {
          x,
          y: rowTop - 2,
          size: 9,
          font: boldFont,
          color: mutedText
        });
        let valueY = rowTop - 18;
        wrapText(value, 10, columnWidth).forEach((line) => {
          page.drawText(line, {
            x,
            y: valueY,
            size: 10,
            font: regularFont,
            color: darkText,
            maxWidth: columnWidth
          });
          valueY -= 14;
        });
      };

      drawEntry(contentLeft + 14, leftEntry[0], leftEntry[1]);
      drawEntry(rightColumnX, rightEntry[0], rightEntry[1]);
      rowTop -= rowHeight;
    });

    cursorY -= cardHeight + sectionGap;
  }

  function drawChecklistHeader(title: string) {
    const headerHeight = 30;
    drawCardShell(headerHeight, { headerTitle: title });
    cursorY -= headerHeight;
  }

  function drawChecklistRow(label: string, value: string) {
    const labelWidth = contentWidth - 108;
    const valueWidth = 66;
    const labelLines = wrapText(label, 9.5, labelWidth);
    const rowHeight = Math.max(labelLines.length * 13, 18) + 16;
    ensureSpace(rowHeight);

    page.drawRectangle({
      x: contentLeft,
      y: cursorY - rowHeight,
      width: contentWidth,
      height: rowHeight,
      color: rgb(1, 1, 1),
      opacity: 0.95,
      borderColor: borderBlue,
      borderWidth: 1
    });

    let textY = cursorY - 14;
    labelLines.forEach((line) => {
      page.drawText(line, {
        x: contentLeft + 14,
        y: textY,
        size: 9.5,
        font: regularFont,
        color: darkText,
        maxWidth: labelWidth
      });
      textY -= 13;
    });

    page.drawText(value, {
      x: contentRight - valueWidth,
      y: cursorY - 20,
      size: 9.5,
      font: boldFont,
      color: darkText,
      maxWidth: valueWidth - 6
    });

    cursorY -= rowHeight;
  }

  drawMetaCard();
  drawTwoColumnInfoCard();
  drawSectionCard("Bevindingen", inspection.findings);
  drawSectionCard("Aanbevelingen", inspection.recommendations);
  drawSectionCard("Conclusie", inspection.conclusion);

  let checklistStarted = false;
  form.sections.forEach((section) => {
    if (!checklistStarted) {
      drawChecklistHeader("Checklist");
      checklistStarted = true;
    } else if (cursorY - 48 < contentBottom) {
      nextPage();
      drawChecklistHeader("Checklist vervolg");
    }

    drawChecklistHeader(section.title);
    section.items.forEach((item) => {
      if (cursorY - 44 < contentBottom) {
        nextPage();
        drawChecklistHeader("Checklist vervolg");
        drawChecklistHeader(section.title);
      }

      drawChecklistRow(item.label, inspection.checklist[item.key] ?? "n.v.t.");
    });
  });

  const pdfBytes = await pdfDocument.save();

  const wordBuffer = await generateWordFromTemplate(inspection);

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
    pdfPath = path.join(baseDir, `${reportBaseName}.pdf`);
    wordPath = path.join(baseDir, `${reportBaseName}.docx`);
    await writeFile(pdfPath, pdfBytes);
    await writeFile(wordPath, wordBuffer);
  }

  return {
    pdfBuffer: Buffer.from(pdfBytes),
    wordBuffer,
    pdfFileName: `${reportBaseName}.pdf`,
    wordFileName: `${reportBaseName}.docx`,
    pdfPath,
    wordPath
  };
}
