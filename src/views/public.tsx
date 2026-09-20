import { raw } from "hono/html";
import {
  domains,
  kinds,
  matches,
  relationLabels,
  statuses,
  type PublicProject,
} from "../content/model";
import { renderMarkdown } from "../content/markdown";
import {
  Architecture,
  Arrow,
  formatDate,
  ProjectGraph,
  SectionHeading,
  Status,
  Tags,
} from "./shared";

export function Archive({
  projects,
  query,
}: {
  projects: PublicProject[];
  query: URLSearchParams;
}) {
  const count = projects.filter((p) => matches(p, query)).length;
  const selected = projects.filter((p) => p.featured).slice(0, 2);
  const ordered = [
    ...selected,
    ...projects.filter((p) => !selected.includes(p)),
  ];
  const technologies = [
    ...new Set(projects.flatMap((p) => p.technologies)),
  ].sort();
  const years = [
    ...new Set(
      projects.flatMap((p) =>
        p.startYear === null
          ? []
          : Array.from(
              {
                length:
                  (p.endYear ?? new Date().getUTCFullYear()) - p.startYear + 1,
              },
              (_, i) => String(p.startYear! + i),
            ),
      ),
    ),
  ]
    .sort()
    .reverse();
  return (
    <div class="page archive-page">
      <section class="intro">
        <div>
          <p class="eyebrow">Notes from a hands-on practice</p>
          <h1>
            Systems take <em>shape.</em>
          </h1>
        </div>
        <p>
          Infrastructure, software and the experiments in between.
          <br />
          An evolving record of what I build, and how it connects.
        </p>
      </section>
      <form
        class="explorer"
        method="get"
        action="/projects"
        id="explorer"
        role="search"
      >
        <div class="search-field">
          <label for="search">Search the archive</label>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            id="search"
            name="q"
            value={query.get("q") || ""}
            placeholder="Try Docker, networking, or cameras…"
            maxlength={200}
            autocomplete="off"
          />
        </div>
        <div class="filter-field">
          <label for="domain">Domain</label>
          <select id="domain" name="domain">
            <option value="">All domains</option>
            {domains.map((d) => (
              <option selected={query.get("domain") === d}>{d}</option>
            ))}
          </select>
        </div>
        <div class="filter-field">
          <label for="status">State</label>
          <select id="status" name="status">
            <option value="">Every state</option>
            <option value="active" selected={query.get("status") === "active"}>
              Active work
            </option>
            {statuses.map((s) => (
              <option value={s} selected={query.get("status") === s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <details
          class="more-filters"
          open={
            !!(
              query.get("technology") ||
              query.get("year") ||
              query.get("kind")
            )
          }
        >
          <summary>
            More filters <span aria-hidden="true">+</span>
          </summary>
          <div class="extra-filters">
            <label>
              Technology
              <select name="technology">
                <option value="">All technologies</option>
                {technologies.map((t) => (
                  <option selected={query.get("technology") === t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Year
              <select name="year">
                <option value="">Any year</option>
                {years.map((y) => (
                  <option selected={query.get("year") === y}>{y}</option>
                ))}
              </select>
            </label>
            <label>
              Material
              <select name="kind">
                <option value="">Hardware + software</option>
                {kinds.map((k) => (
                  <option value={k} selected={query.get("kind") === k}>
                    {k.toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </details>
        <button type="submit" class="filter-submit">
          Explore <Arrow />
        </button>
      </form>
      <div class="results-heading">
        <span class="eyebrow">The collection</span>
        <span id="result-count" aria-live="polite">
          {count} of {projects.length} records
        </span>
        <a href="/projects" id="clear-filters">
          Clear filters
        </a>
      </div>
      <div class="project-grid" id="project-results">
        {ordered.map((p, i) => (
          <ProjectCard
            p={p}
            index={i + 1}
            primary={selected.includes(p) && i === 0}
            compact={!selected.includes(p)}
            hidden={!matches(p, query)}
          />
        ))}
      </div>
      <div class="empty-state" id="empty-results" hidden={count > 0}>
        <span class="empty-symbol" aria-hidden="true">
          ∅
        </span>
        <h2>No matching records.</h2>
        <p>Try another keyword or open up a filter.</p>
        <a href="/projects" class="button">
          Reset the collection
        </a>
      </div>
      <section class="lineage-preview">
        <SectionHeading number="02" title="Nothing starts from nothing.">
          <a href="/atlas">
            Explore the atlas <Arrow />
          </a>
        </SectionHeading>
        <p>
          Networks became storage. Storage became services. New questions became
          the next projects.
        </p>
        <ProjectGraph projects={projects} />
      </section>
      <section class="archive-note">
        <span class="eyebrow">Reading this archive</span>
        <p>
          <strong>Built</strong> records an implementation.{" "}
          <strong>Evolving</strong> describes a system still changing.{" "}
          <strong>Experiments</strong> explore a question;{" "}
          <strong>historical</strong> work preserves an earlier chapter. Dates
          reflect the available record, and diagrams use conceptual names.
        </p>
      </section>
    </div>
  );
}
function ProjectCard({
  p,
  index,
  primary = false,
  hidden = false,
  compact = false,
}: {
  p: PublicProject;
  index: number;
  primary?: boolean;
  hidden?: boolean;
  compact?: boolean;
}) {
  return (
    <article
      class={`project-card ${primary ? "primary-project" : ""} ${p.featured && !primary ? "featured-project" : ""} ${compact ? "project-row" : ""}`}
      hidden={hidden}
      data-project={p.slug}
      data-search={[
        p.title,
        p.subtitle,
        p.summary,
        ...p.technologies,
        p.domain,
        p.status,
      ]
        .join(" ")
        .toLowerCase()}
      data-domain={p.domain}
      data-status={p.status}
      data-kind={p.kind}
      data-technologies={JSON.stringify(
        p.technologies.map((t) => t.toLowerCase()),
      )}
      data-start={p.startYear ?? ""}
      data-end={p.endYear ?? new Date().getUTCFullYear()}
    >
      <div class="card-top">
        <span class="record-no">
          {String(index).padStart(2, "0")} <span>/ {p.domain}</span>
        </span>
        <Status value={p.status} />
      </div>
      <div class="card-copy">
        <p class="card-kicker">
          {p.featured ? "Selected system" : p.kind.toLowerCase()}
        </p>
        <h2>
          <a href={`/projects/${p.slug}`}>
            {p.title} <Arrow />
          </a>
        </h2>
        <p>{p.summary}</p>
      </div>
      {primary && <Architecture data={p.architecture} title={p.title} dark />}
      {!primary && !compact && (
        <div class="selected-tools">
          <span class="eyebrow">Working with</span>
          <Tags values={p.technologies.slice(0, 5)} />
        </div>
      )}
      <div class="card-bottom">
        <span>{p.timeframe}</span>
        <span>{p.technologies.slice(0, 3).join(" / ")}</span>
      </div>
    </article>
  );
}

export function CaseStudy({
  project: p,
  projects,
  preview = false,
}: {
  project: PublicProject;
  projects: PublicProject[];
  preview?: boolean;
}) {
  return (
    <article class="page case-page">
      {preview && (
        <div class="preview-banner">
          <strong>Draft preview</strong>
          <span>This version is private. Publishing is a separate action.</span>
          <a href="/admin">Back to editor</a>
        </div>
      )}
      <a href="/projects" class="back-link">
        ← All records
      </a>
      <div class="case-mast">
        <div class="case-eyebrow">
          <span class="eyebrow">
            {p.domain} / {p.kind.toLowerCase()}
          </span>
          <Status value={p.status} />
        </div>
        <h1>{p.title}</h1>
        <p class="case-subtitle">{p.subtitle}</p>
        <p class="case-summary">{p.summary}</p>
        <div class="case-meta">
          <span>{p.timeframe}</span>
          <span>Personal project · Sameer Akhtari</span>
        </div>
      </div>
      <div class="case-layout">
        <aside class="case-sidebar">
          <p class="eyebrow">In this record</p>
          <nav aria-label="Case study sections">
            {p.architecture.nodes.length > 0 && (
              <a href="#architecture">Architecture</a>
            )}
            {p.sections.map((s, i) => (
              <a href={`#section-${i}`}>{s.heading}</a>
            ))}
            {p.updates.length > 0 && <a href="#updates">Build log</a>}
            {p.nextIteration && <a href="#next">Next iteration</a>}
          </nav>
          <div class="technology-block">
            <p class="eyebrow">Working with</p>
            <Tags values={p.technologies} />
          </div>
          {p.links.length > 0 && (
            <div class="source-links">
              <p class="eyebrow">Source & context</p>
              {p.links.map((l) => (
                <a href={l.url} rel="noopener noreferrer">
                  {l.label} <Arrow />
                </a>
              ))}
            </div>
          )}
        </aside>
        <div class="case-content">
          {p.architecture.nodes.length > 0 && (
            <section id="architecture">
              <SectionHeading number="↳" title="How it fits together" />
              <Architecture data={p.architecture} title={p.title} />
            </section>
          )}
          {p.sections.map((s, i) => (
            <section class="case-section" id={`section-${i}`}>
              <span class="index-number">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h2>{s.heading}</h2>
                <div class="prose">{raw(renderMarkdown(s.body))}</div>
              </div>
            </section>
          ))}
          {p.media.length > 0 && (
            <section>
              <h2>From the build</h2>
              <div class="media-gallery">
                {p.media.map((m) => (
                  <figure>
                    <img
                      src={`${preview ? "/api/admin/media" : "/media"}/${m.id}`}
                      alt={m.alt}
                      width={m.width}
                      height={m.height}
                      loading="lazy"
                      decoding="async"
                    />
                    {m.caption && <figcaption>{m.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            </section>
          )}
          {p.updates.length > 0 && (
            <section id="updates" class="case-updates">
              <SectionHeading number="↳" title="The build log" />
              <UpdateList
                entries={p.updates.map((u) => ({ ...u, project: p }))}
              />
            </section>
          )}
          {p.nextIteration && (
            <section id="next" class="next-iteration">
              <span class="eyebrow">Still on the workbench</span>
              <h2>The next iteration</h2>
              <div class="prose">{raw(renderMarkdown(p.nextIteration))}</div>
            </section>
          )}
        </div>
      </div>
      {p.relationships.length > 0 && (
        <section class="related-section">
          <SectionHeading number="↳" title="Part of a longer story" />
          <div class="related-grid">
            {p.relationships.map((r) => {
              const q = projects.find((x) => x.slug === r.target);
              return q ? (
                <a href={`/projects/${q.slug}`}>
                  <span class="eyebrow">{relationLabels[r.type]}</span>
                  <h3>
                    {q.title} <Arrow />
                  </h3>
                  <p>{r.note}</p>
                </a>
              ) : null;
            })}
          </div>
        </section>
      )}
    </article>
  );
}
export function Atlas({ projects }: { projects: PublicProject[] }) {
  const isolated = projects.filter(
    (p) =>
      !p.relationships.length &&
      !projects.some((q) => q.relationships.some((r) => r.target === p.slug)),
  );
  return (
    <div class="page">
      <section class="intro">
        <div>
          <p class="eyebrow">Explore the relationships</p>
          <h1>
            A system of <em>systems.</em>
          </h1>
        </div>
        <p>
          Follow the lineage from an earlier foundation to a newer experiment.
          Connections describe real relationships in the project record.
        </p>
      </section>
      <ProjectGraph projects={projects} />
      <section class="domain-index">
        <SectionHeading number="01" title="Follow a thread" />
        <div class="domain-grid">
          {domains.map((d) => {
            const ps = projects.filter((p) => p.domain === d);
            return (
              <a href={`/projects?domain=${encodeURIComponent(d)}`}>
                <span class="record-no">
                  {String(ps.length).padStart(2, "0")} records
                </span>
                <h3>
                  {d} <Arrow />
                </h3>
                <p>
                  {[...new Set(ps.flatMap((p) => p.technologies))]
                    .slice(0, 4)
                    .join(" · ")}
                </p>
              </a>
            );
          })}
        </div>
      </section>
      {isolated.length > 0 && (
        <section class="independent-projects">
          <SectionHeading number="02" title="Independent investigations" />
          <p>These records stand on their own; a connection is not assumed.</p>
          <div class="related-grid">
            {isolated.map((p) => (
              <a href={`/projects/${p.slug}`}>
                <Status value={p.status} />
                <h3>
                  {p.title} <Arrow />
                </h3>
                <p>{p.summary}</p>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
export function UpdateList({
  entries,
}: {
  entries: (PublicProject["updates"][number] & { project: PublicProject })[];
}) {
  return (
    <ol class="update-list">
      {[...entries]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((e) => (
          <li>
            <div class="update-date">
              <time datetime={e.date}>{formatDate(e.date)}</time>
              <span class={`log-kind ${e.kind === "PLANNED" ? "planned" : ""}`}>
                {e.kind.toLowerCase()}
              </span>
            </div>
            <div>
              <a href={`/projects/${e.project.slug}`} class="update-project">
                {e.project.title}
              </a>
              <h3>{e.title}</h3>
              <div class="prose">{raw(renderMarkdown(e.body))}</div>
            </div>
          </li>
        ))}
    </ol>
  );
}
export function BuildLog({ projects }: { projects: PublicProject[] }) {
  const entries = projects.flatMap((p) =>
    p.updates.map((u) => ({ ...u, project: p })),
  );
  return (
    <div class="page log-page">
      <section class="intro">
        <div>
          <p class="eyebrow">Milestones, questions & next steps</p>
          <h1>
            A record of <em>change.</em>
          </h1>
        </div>
        <p>
          Each entry belongs to a project. Month- and year-only dates preserve
          the precision of the available evidence.
        </p>
      </section>
      <UpdateList entries={entries} />
    </div>
  );
}
export function ErrorPage({
  code,
  title,
  body,
}: {
  code: string;
  title: string;
  body: string;
}) {
  return (
    <div class="page error-page">
      <span class="eyebrow">{code}</span>
      <h1>{title}</h1>
      <p>{body}</p>
      <a class="button" href="/">
        Return to the archive <Arrow />
      </a>
    </div>
  );
}
