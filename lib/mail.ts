export function buildCustomerMail(name: string) {
  return {
    subject: "Keuringsrapport van je machine",
    html: `
      <p>Beste ${name || "klant"},</p>
      <p>De keuring van de machine is afgerond. In de bijlage vind je het keuringsrapport met alle bevindingen.</p>
      <p>Mocht je vragen hebben, service of onderhoud willen inplannen of iets willen bespreken naar aanleiding van de keuring, laat het gerust weten. We kijken graag met je mee.</p>
      <p>Met vriendelijke groet,<br />Age Terpstra<br />Heftrucks Friesland<br />0653842843</p>
    `
  };
}

export function buildInternalMail(companyName: string, inspectionNumber: string) {
  return {
    subject: `${companyName} ${inspectionNumber}`,
    text: `Interne archiefmail voor keuring ${inspectionNumber}.`
  };
}
