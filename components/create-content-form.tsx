"use client";

import { useActionState, useMemo, useState } from "react";
import { WandSparkles } from "lucide-react";
import {
  contentModes,
  getModeConfig,
  stylePrinciples,
  type ContentMode
} from "@/lib/content-platform";
import {
  createContentAction,
  type CreateContentState
} from "@/app/create-content/actions";

const initialState: CreateContentState = {
  success: false
};

export function CreateContentForm() {
  const [selectedMode, setSelectedMode] = useState<ContentMode>("blog");
  const [state, formAction, isPending] = useActionState(createContentAction, initialState);
  const mode = useMemo(() => getModeConfig(selectedMode), [selectedMode]);

  return (
    <div className="content-workspace">
      <section className="panel">
        <div className="eyebrow">Content modes</div>
        <h1>Genereer content in Jolanda&apos;s stijl</h1>
        <p className="muted">
          Kies een contenttype, geef je onderwerp en richting mee, en laat de app output
          genereren die direct bruikbaar is voor web, mail of social.
        </p>

        <div className="mode-grid" role="tablist" aria-label="Contenttypen">
          {contentModes.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`mode-card ${selectedMode === item.id ? "active" : ""}`}
              onClick={() => setSelectedMode(item.id)}
            >
              <strong>{item.label}</strong>
              <span>{item.tagline}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid-2 content-grid">
        <form action={formAction} className="panel generator-form">
          <input type="hidden" name="mode" value={selectedMode} />

          <div className="eyebrow">Briefing</div>
          <h2>{mode.label}</h2>
          <p className="muted">{mode.description}</p>

          <div className="field">
            <label htmlFor="topic">Onderwerp</label>
            <input
              id="topic"
              name="topic"
              placeholder="Bijv. waarom vrouwen hun grenzen blijven uitleggen"
              required
            />
          </div>

          {mode.fields.map((field) => (
            <div className="field" key={field.name}>
              <label htmlFor={field.name}>{field.label}</label>
              <input id={field.name} name={field.name} placeholder={field.placeholder} />
            </div>
          ))}

          <div className="field">
            <label htmlFor="extraInstructions">Extra instructies</label>
            <textarea
              id="extraInstructions"
              name="extraInstructions"
              placeholder="Bijv. neem een praktijkvoorbeeld op, vermijd het woord heling, schrijf in korte alinea's"
            />
          </div>

          <div className="generator-actions">
            <button className="button" type="submit" disabled={isPending}>
              <WandSparkles size={18} />
              <span>{isPending ? "Bezig met genereren..." : "Genereer content"}</span>
            </button>
          </div>

          {state.error ? <p className="form-message info">{state.error}</p> : null}
        </form>

        <aside className="panel style-card">
          <div className="eyebrow">Style guardrails</div>
          <h2>Wat de engine bewaakt</h2>
          <div className="list compact-list">
            {stylePrinciples.map((principle) => (
              <div className="list-item static-list-item" key={principle}>
                <span>{principle}</span>
              </div>
            ))}
          </div>

          <div className="output-hint">
            <strong>Primaire output</strong>
            <span>{mode.primaryOutput}</span>
          </div>
        </aside>
      </section>

      <section className="grid-2 content-grid">
        <article className="panel output-panel">
          <div className="eyebrow">Resultaat</div>
          <h2>{state.result?.title ?? "Nog geen output"}</h2>
          <p className="muted">
            {state.result?.intro ??
              "Na generatie verschijnt hier de eerste versie van de content inclusief kernpunten en CTA."}
          </p>

          {state.result ? (
            <>
              <div className="result-meta">
                {state.result.meta?.seoTitle ? (
                  <div className="info-card">
                    <strong>SEO titel</strong>
                    <span>{state.result.meta.seoTitle}</span>
                  </div>
                ) : null}
                {state.result.meta?.metaDescription ? (
                  <div className="info-card">
                    <strong>Meta description</strong>
                    <span>{state.result.meta.metaDescription}</span>
                  </div>
                ) : null}
                {state.result.meta?.focusKeyword ? (
                  <div className="info-card">
                    <strong>Focus keyword</strong>
                    <span>{state.result.meta.focusKeyword}</span>
                  </div>
                ) : null}
                {state.result.meta?.hook ? (
                  <div className="info-card">
                    <strong>Hook</strong>
                    <span>{state.result.meta.hook}</span>
                  </div>
                ) : null}
              </div>

              <div className="field">
                <label>Kernopbouw</label>
                <div className="list compact-list">
                  {state.result.bullets.map((bullet) => (
                    <div className="list-item static-list-item" key={bullet}>
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>HTML output</label>
                <textarea readOnly value={state.result.html} className="code-output" />
              </div>
            </>
          ) : null}
        </article>

        <article className="panel prompt-panel">
          <div className="eyebrow">AI layer</div>
          <h2>Prompt preview</h2>
          <p className="muted">
            Deze prompt wordt gebruikt als basis voor GPT/OpenAI, met later uitbreidbare RAG
            context uit uploads, websitecontent en feedback.
          </p>
          <textarea
            readOnly
            value={
              state.prompt ??
              "Nog geen prompt opgebouwd. Vul links een briefing in om de prompt te genereren."
            }
            className="code-output code-output-tall"
          />
        </article>
      </section>
    </div>
  );
}
