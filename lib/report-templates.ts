import type { ChecklistOption, FormDefinition } from "@/lib/types";

interface ReportContext {
  inspectionNumber: string;
  date: string;
  customerName: string;
  customerAddress: string;
  contactName: string;
  machineName: string;
  findings: string;
  checklist: Record<string, ChecklistOption>;
}

function renderChecklistRows(
  form: FormDefinition,
  values: Record<string, ChecklistOption>
) {
  return form.sections
    .map((section) => {
      const items = section.items
        .map(
          (item) => `
            <tr>
              <td>${item.label}</td>
              <td>${values[item.key] ?? "n.v.t."}</td>
            </tr>
          `
        )
        .join("");

      return `
        <tr>
          <th colspan="2" style="background:#deecfb;color:#003e6e;padding:10px 12px;text-align:left;">${section.title}</th>
        </tr>
        ${items}
      `;
    })
    .join("");
}

export function buildPdfHtml(form: FormDefinition, context: ReportContext) {
  return `
    <html>
      <body style="font-family:Segoe UI,Arial,sans-serif;padding:32px;color:#111827;">
        <header style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
          <div>
            <div style="font-size:24px;font-weight:700;color:#005ea8;">Heftrucks Friesland</div>
            <div style="font-size:12px;color:#526273;">BMWT keuringsrapport</div>
          </div>
          <div style="text-align:right;font-size:12px;">
            <div><strong>Keurnummer:</strong> ${context.inspectionNumber}</div>
            <div><strong>Datum:</strong> ${context.date}</div>
            <div><strong>Type:</strong> ${form.title}</div>
          </div>
        </header>
        <section style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
          <div style="padding:16px;border:1px solid #c6d3e0;border-radius:16px;">
            <strong>Klant</strong>
            <div>${context.customerName}</div>
            <div>${context.customerAddress}</div>
            <div>${context.contactName}</div>
          </div>
          <div style="padding:16px;border:1px solid #c6d3e0;border-radius:16px;">
            <strong>Machine</strong>
            <div>${context.machineName}</div>
          </div>
        </section>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          ${renderChecklistRows(form, context.checklist)}
        </table>
        <section style="margin-top:24px;">
          <h3 style="margin-bottom:8px;">Opmerkingen</h3>
          <p>${context.findings || "-"}</p>
        </section>
      </body>
    </html>
  `;
}

export function buildWordTemplateText(form: FormDefinition) {
  return [
    `Template: ${form.title}`,
    "Header:",
    "- Logo heftrucks.frl",
    "- BMWT logo",
    "- Keurnummer",
    "- Klantgegevens",
    "- Machinegegevens",
    "Secties:",
    ...form.sections.map((section) => `- ${section.title}: ${section.items.length} controlepunten`),
    "Afsluiting:",
    "- Opmerkingen",
    `- Statusopties: ${form.conclusionLabels.join(", ")}`
  ].join("\n");
}
