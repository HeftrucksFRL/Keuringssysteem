export type ContentMode =
  | "blog"
  | "newsletter"
  | "instagram"
  | "facebook"
  | "website"
  | "video";

export type SourceType =
  | "Blog"
  | "Nieuwsbrief"
  | "Website"
  | "Instagram"
  | "Facebook"
  | "Transcript"
  | "Brand guide";

export type KnowledgeStatus = "Indexed" | "Review nodig" | "Klaar voor training";

export type StyleSource = {
  id: string;
  title: string;
  type: SourceType;
  words: number;
  note: string;
  status: KnowledgeStatus;
};

export type GenerationRecord = {
  id: string;
  mode: ContentMode;
  title: string;
  createdAt: string;
  status: "Favoriet" | "Concept" | "Verbeterd met feedback";
  summary: string;
};

export type ModeConfig = {
  id: ContentMode;
  label: string;
  tagline: string;
  description: string;
  primaryOutput: string;
  fields: Array<{
    name: "audience" | "goal" | "keywords" | "channels" | "cta";
    label: string;
    placeholder: string;
  }>;
};

export type GeneratedContent = {
  title: string;
  intro: string;
  bullets: string[];
  cta: string;
  html: string;
  meta?: {
    seoTitle?: string;
    metaDescription?: string;
    focusKeyword?: string;
    hook?: string;
    captionTitle?: string;
  };
};

export const contentModes: ModeConfig[] = [
  {
    id: "blog",
    label: "Blog",
    tagline: "SEO + HTML output",
    description: "Lange vorm content met zoekintentie, tussenkoppen en een directe CTA.",
    primaryOutput: "Yoast-proof blogstructuur",
    fields: [
      {
        name: "audience",
        label: "Voor wie schrijf je dit?",
        placeholder: "Bijv. vrouwelijke ondernemers die te veel dragen en te weinig kiezen"
      },
      {
        name: "goal",
        label: "Wat moet de lezer na afloop denken of doen?",
        placeholder: "Bijv. een consult boeken of haar huidige patroon herkennen"
      },
      {
        name: "keywords",
        label: "Focus keyword of SEO-hoeken",
        placeholder: "Bijv. grenzen aangeven, vrouwelijke energie, leiderschap"
      },
      {
        name: "cta",
        label: "Gewenste CTA",
        placeholder: "Plan een kennismaking of reageer op de mail"
      }
    ]
  },
  {
    id: "newsletter",
    label: "Nieuwsbrief",
    tagline: "Persoonlijk en nieuwsgierigmakend",
    description: "Mailopzet met openingshaak, 3 tot 4 invalshoeken en zachte conversie.",
    primaryOutput: "Onderwerpregel + e-mail body",
    fields: [
      {
        name: "audience",
        label: "Wie leest mee?",
        placeholder: "Bijv. bestaande klanten en warme leads"
      },
      {
        name: "goal",
        label: "Wat is het doel van deze nieuwsbrief?",
        placeholder: "Bijv. inschrijven voor een sessie of bewustwording vergroten"
      },
      {
        name: "channels",
        label: "Eventuele rubrieken of onderwerpen",
        placeholder: "Bijv. inzicht, praktijkvoorbeeld, uitnodiging, agenda"
      },
      {
        name: "cta",
        label: "Gewenste CTA",
        placeholder: "Antwoord op deze mail of plan direct een call"
      }
    ]
  },
  {
    id: "instagram",
    label: "Instagram",
    tagline: "Caption met spanning",
    description: "Kort, ritmisch en direct. Gericht op hooks, nieuwsgierigheid en save-waarde.",
    primaryOutput: "Caption + hook",
    fields: [
      {
        name: "audience",
        label: "Voor welke volger?",
        placeholder: "Bijv. ambitieuze vrouwen die voelen dat ze vastlopen"
      },
      {
        name: "goal",
        label: "Wat moet deze post losmaken?",
        placeholder: "Bijv. herkenning, reacties of DM's"
      },
      {
        name: "channels",
        label: "Format of context",
        placeholder: "Bijv. carousel, reel, talking head"
      },
      {
        name: "cta",
        label: "Gewenste CTA",
        placeholder: "Bijv. reageer met 'helder' of stuur me een DM"
      }
    ]
  },
  {
    id: "facebook",
    label: "Facebook",
    tagline: "Iets langer, meer context",
    description: "Meer verhaal, meer context, maar nog steeds scherp en niet verkoperig.",
    primaryOutput: "Facebook-post",
    fields: [
      {
        name: "audience",
        label: "Voor wie is deze post bedoeld?",
        placeholder: "Bijv. bestaande community en lokale volgers"
      },
      {
        name: "goal",
        label: "Wat wil je bereiken?",
        placeholder: "Bijv. gesprek openen of inschrijving stimuleren"
      },
      {
        name: "channels",
        label: "Context of aanleiding",
        placeholder: "Bijv. event, observatie, klantverhaal"
      },
      {
        name: "cta",
        label: "Gewenste CTA",
        placeholder: "Bijv. laat me weten wat je herkent"
      }
    ]
  },
  {
    id: "website",
    label: "Website pagina",
    tagline: "SEO-pagina met overtuiging",
    description: "Pagina-opzet met waardepropositie, secties, CTA en tone of voice-bewaking.",
    primaryOutput: "SEO-landingspagina",
    fields: [
      {
        name: "audience",
        label: "Voor wie is deze pagina?",
        placeholder: "Bijv. vrouwen die 1-op-1 begeleiding zoeken"
      },
      {
        name: "goal",
        label: "Conversiedoel",
        placeholder: "Bijv. kennismakingsgesprek inplannen"
      },
      {
        name: "keywords",
        label: "SEO zoektermen",
        placeholder: "Bijv. persoonlijke groei coach, leiderschap voor vrouwen"
      },
      {
        name: "cta",
        label: "Primair CTA blok",
        placeholder: "Bijv. Plan jouw intake"
      }
    ]
  },
  {
    id: "video",
    label: "Video script",
    tagline: "Hook + opbouw + caption",
    description: "Scripts voor short en long form video met een stevige eerste 3 seconden.",
    primaryOutput: "Script + caption",
    fields: [
      {
        name: "audience",
        label: "Wie kijkt deze video?",
        placeholder: "Bijv. ondernemers die steeds over hun grens gaan"
      },
      {
        name: "goal",
        label: "Wat moet de video doen?",
        placeholder: "Bijv. DM's openen of een patroon doorbreken"
      },
      {
        name: "channels",
        label: "Platform of format",
        placeholder: "Bijv. YouTube short, TikTok, long form YouTube"
      },
      {
        name: "cta",
        label: "Gewenste CTA",
        placeholder: "Bijv. reageer of plan een gesprek"
      }
    ]
  }
];

export const stylePrinciples = [
  "Direct zonder hard te worden",
  "Warm zonder wollig te worden",
  "Licht confronterend als dat nodig is",
  "Niet zweverig en niet salesy",
  "Heldere zinnen met ritme en spanning",
  "Geen emoji's in blogs en nieuwsbrieven"
] as const;

export const styleSources: StyleSource[] = [
  {
    id: "src-1",
    title: "Website homepage Jolanda",
    type: "Website",
    words: 1420,
    note: "Sterke basis voor positionering, belofte en CTA-ritme.",
    status: "Indexed"
  },
  {
    id: "src-2",
    title: "Nieuwsbriefarchief Q1",
    type: "Nieuwsbrief",
    words: 3860,
    note: "Goede voorbeelden van open lussen en persoonlijke observaties.",
    status: "Klaar voor training"
  },
  {
    id: "src-3",
    title: "Instagram captions selectie",
    type: "Instagram",
    words: 2160,
    note: "Laat tempo, hooks en confronterende openingszinnen zien.",
    status: "Indexed"
  },
  {
    id: "src-4",
    title: "Brand guide tone of voice",
    type: "Brand guide",
    words: 980,
    note: "Definieert verboden woorden, favoriete formuleringen en overtuigingen.",
    status: "Review nodig"
  }
];

export const generationHistory: GenerationRecord[] = [
  {
    id: "gen-101",
    mode: "blog",
    title: "Waarom je leiderschap breekt als je altijd beschikbaar blijft",
    createdAt: "2026-03-31 10:12",
    status: "Favoriet",
    summary: "Blog met sterke SEO-opbouw, CTA naar consult en HTML-export."
  },
  {
    id: "gen-102",
    mode: "newsletter",
    title: "Je hoeft niet nóg meer te dragen om waardevol te zijn",
    createdAt: "2026-03-30 08:47",
    status: "Verbeterd met feedback",
    summary: "Onderwerpregel aangescherpt op nieuwsgierigheid en intro compacter gemaakt."
  },
  {
    id: "gen-103",
    mode: "instagram",
    title: "De meeste vrouwen noemen dit loyaliteit, maar het is zelfverlating",
    createdAt: "2026-03-29 16:20",
    status: "Concept",
    summary: "Carousel-caption met 5 slides, save-call en DM CTA."
  }
];

export function getModeConfig(mode: string) {
  return contentModes.find((item) => item.id === mode) ?? contentModes[0];
}

function paragraph(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

export function buildFallbackContent(input: {
  mode: ContentMode;
  topic: string;
  audience?: string;
  goal?: string;
  keywords?: string;
  channels?: string;
  cta?: string;
  extraInstructions?: string;
}): GeneratedContent {
  const mode = getModeConfig(input.mode);
  const keyword = input.keywords?.split(",")[0]?.trim() || input.topic;
  const action = input.cta?.trim() || "Plan een consult";
  const audience = input.audience?.trim() || "vrouwen die voelen dat het anders moet";
  const goal = input.goal?.trim() || "een scherp inzicht meegeven en aanzetten tot actie";
  const channel = input.channels?.trim() || mode.primaryOutput.toLowerCase();
  const intro = paragraph(
    `Je voelt waarschijnlijk al langer dat ${input.topic.toLowerCase()} niet het echte probleem is. Het probleem is dat je te lang loyaal blijft aan een patroon dat je klein houdt.`
  );
  const bullets = [
    `Maak meteen duidelijk voor ${audience} waarom dit onderwerp schuurt.`,
    `Verbind het onderwerp aan een concreet patroon of misverstand dat vaak wordt genormaliseerd.`,
    `Werk toe naar ${goal} zonder zwaar of uitleggerig te worden.`,
    `Sluit af met een directe maar warme uitnodiging: ${action}.`
  ];

  if (input.mode === "blog" || input.mode === "website") {
    const title =
      input.mode === "blog"
        ? `Waarom ${input.topic.toLowerCase()} je kleiner houdt dan nodig is`
        : `${input.topic}: helder leiderschap zonder jezelf kwijt te raken`;

    const html = [
      `<article>`,
      `<h1>${title}</h1>`,
      `<p>${intro}</p>`,
      `<h2>Wat er echt speelt</h2>`,
      `<p>Veel mensen proberen het op te lossen met nog meer discipline, nog meer aanpassen of nog meer geven. Maar als je eerlijk kijkt, zie je meestal iets anders: je bent aan het compenseren voor een grens die je al te lang negeert.</p>`,
      `<h2>Waarom dit patroon je energie kost</h2>`,
      `<p>Het lijkt verantwoord. Het lijkt liefdevol. Het lijkt professioneel. Toch schuurt het, omdat je continu aan het leveren bent vanuit controle in plaats van vanuit helderheid. En precies daar verlies je kracht, richting en aantrekkingskracht.</p>`,
      `<h3>Wat je wél wilt</h3>`,
      `<p>Je wilt keuzes maken die kloppen. Niet omdat iemand anders dat van je verwacht, maar omdat je weet waar je voor staat. Dat vraagt niet om meer trucjes, maar om meer eerlijkheid.</p>`,
      `<p><strong>${action}</strong> als je dit niet alleen wilt uitzoeken.</p>`,
      `</article>`
    ].join("");

    return {
      title,
      intro,
      bullets,
      cta: action,
      html,
      meta: {
        seoTitle: `${title} | Jolanda Pouwels`,
        metaDescription: `Ontdek waarom ${keyword.toLowerCase()} vaak een dieper patroon verhult en wat je kunt doen om weer helder te kiezen.`,
        focusKeyword: keyword
      }
    };
  }

  if (input.mode === "newsletter") {
    return {
      title: `Je blijft het misschien nog netjes noemen. Maar het schuurt al langer.`,
      intro,
      bullets: [
        `Onderwerpregel: Je hoeft niet nog meer te dragen om waardevol te zijn`,
        `Open met een observatie die spanning oproept en nog niet alles weggeeft.`,
        `Werk 3 korte invalshoeken uit rond ${input.topic.toLowerCase()}.`,
        `Laat de mail eindigen met ${action}.`
      ],
      cta: action,
      html: `<section><h1>Onderwerpregel</h1><p>Je hoeft niet nog meer te dragen om waardevol te zijn</p><h2>Intro</h2><p>${intro}</p><h2>Insteek</h2><p>Vandaag wil ik iets benoemen wat veel vrouwen rationeel begrijpen, maar emotioneel nog steeds in stand houden.</p><p>Je denkt misschien dat je sterk bent omdat je alles opvangt. In werkelijkheid ben je soms vooral aan het voorkomen dat iemand anders oncomfortabel wordt.</p><p>${action}</p></section>`,
      meta: {
        hook: "Open met een zin die spanning opbouwt en niet meteen verklaart."
      }
    };
  }

  if (input.mode === "video") {
    return {
      title: `Script: ${input.topic}`,
      intro,
      bullets: [
        `Hook eerste 3 seconden: "Als jij dit steeds doet, noem je het misschien kracht. Maar het kost je meer dan je denkt."`,
        `Middenstuk: benoem het patroon, een herkenbaar voorbeeld en de prijs van blijven aanpassen.`,
        `Format: ${channel}. Houd het ritme kort en spreektaalachtig.`,
        `Caption-einde: ${action}.`
      ],
      cta: action,
      html: `<section><h1>${input.topic}</h1><p><strong>Hook:</strong> Als jij dit steeds doet, noem je het misschien kracht. Maar het kost je meer dan je denkt.</p><p><strong>Opbouw:</strong> Benoem het patroon. Geef een concreet voorbeeld. Draai het open met een confronterende waarheid. Eindig met een heldere uitnodiging.</p><p><strong>CTA:</strong> ${action}</p></section>`,
      meta: {
        hook: "Als jij dit steeds doet, noem je het misschien kracht.",
        captionTitle: `${input.topic} | Jolanda Pouwels`
      }
    };
  }

  return {
    title: `${mode.label}: ${input.topic}`,
    intro,
    bullets,
    cta: action,
    html: `<section><h1>${mode.label}: ${input.topic}</h1><p>${intro}</p><p>Dit concept is afgestemd op ${audience} en stuurt aan op ${goal}.</p><p>${action}</p></section>`,
    meta: {
      hook: `Zeg niet te snel dat ${input.topic.toLowerCase()} normaal is.`
    }
  };
}

export function buildStylePrompt(input: {
  mode: ContentMode;
  topic: string;
  audience?: string;
  goal?: string;
  keywords?: string;
  channels?: string;
  cta?: string;
  extraInstructions?: string;
}) {
  const mode = getModeConfig(input.mode);

  return `
Je bent de persoonlijke copywriter van Jolanda Pouwels.

Schrijf in deze stijl:
- Direct
- Warm
- Niet zweverig
- Niet salesy
- Licht confronterend waar nodig
- Geen emoji's in blogs en nieuwsbrieven

Contenttype: ${mode.label}
Onderwerp: ${input.topic}
Doelgroep: ${input.audience || "Niet opgegeven"}
Doel: ${input.goal || "Niet opgegeven"}
SEO/zoektermen: ${input.keywords || "Niet opgegeven"}
Kanaal of format: ${input.channels || "Niet opgegeven"}
CTA: ${input.cta || "Plan een consult"}
Extra instructies: ${input.extraInstructions || "Geen"}

Lever een resultaat dat copy-paste klaar is, onderscheidend voelt en vermijd generieke coachingtaal.
`.trim();
}
