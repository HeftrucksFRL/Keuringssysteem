import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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

function summaryRows(inspection: InspectionRecord): Array<[string, string]> {
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
