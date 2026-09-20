import type { Child } from "hono/jsx";
import { raw } from "hono/html";
import type { PublicProject, ProjectInput } from "../content/model";
import { relationLabels } from "../content/model";

export function Layout({
  title,
  description,
  path,
  origin,
  nonce,
  children,
  admin = false,
  noindex = false,
  structured,
}: {
  title: string;
  description: string;
  path: string;
  origin: string;
  nonce: string;
  children: Child;
  admin?: boolean;
  noindex?: boolean;
  structured?: object;
}) {
  const canonical = new URL(path, origin).href;
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title} · Sameer’s Project Archive</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta
          name="robots"
          content={admin || noindex ? "noindex, nofollow" : "index, follow"}
        />
        <meta
          property="og:type"
          content={path.startsWith("/projects/") ? "article" : "website"}
        />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:site_name" content="Sameer’s Project Archive" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="theme-color" content="#202e35" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="stylesheet" href="/styles.css" />
        {structured && (
          <script nonce={nonce} type="application/ld+json">
            {raw(JSON.stringify(structured).replace(/</g, "\\u003c"))}
          </script>
        )}
        <script src={admin ? "/admin.js" : "/explore.js"} defer></script>
      </head>
      <body class={admin ? "admin-body" : ""}>
        <a class="skip-link" href="#main">
          Skip to content
        </a>
        <header class="masthead">
          <a class="wordmark" href="/" aria-label="Project Archive home">
            <span class="brand-mark" aria-hidden="true">
              sa<span>↗</span>
            </span>
            <span>
              PROJECT
              <br />
              <strong>ARCHIVE</strong>
            </span>
          </a>
          <nav aria-label={admin ? "Administration" : "Main navigation"}>
            {admin ? (
              <>
                <a
                  href="/admin"
                  aria-current={path === "/admin" ? "page" : undefined}
                >
                  Overview
                </a>
                <a
                  href="/admin/media"
                  aria-current={path === "/admin/media" ? "page" : undefined}
                >
                  Media
                </a>
                <a
                  href="/admin/audit"
                  aria-current={path === "/admin/audit" ? "page" : undefined}
                >
                  Activity
                </a>
                <a href="/">Public site ↗</a>
              </>
            ) : (
              <>
                <a
                  href="/"
                  aria-current={
                    path === "/" || path === "/projects" ? "page" : undefined
                  }
                >
                  Index
                </a>
                <a
                  href="/atlas"
                  aria-current={path === "/atlas" ? "page" : undefined}
                >
                  Atlas
                </a>
                <a
                  href="/log"
                  aria-current={path === "/log" ? "page" : undefined}
                >
                  Build log
                </a>
                <a href="/projects?status=active">
                  Now <span class="small-dot" aria-hidden="true"></span>
                </a>
              </>
            )}
          </nav>
          <span class="byline">
            {admin ? "PRIVATE EDITOR" : "Collected by"}
            <strong>{admin ? "Owner workspace" : "Sameer Akhtari"}</strong>
          </span>
        </header>
        <main id="main" tabindex={-1}>
          {children}
        </main>
        <footer class="footer">
          <div>
            <a class="footer-brand" href="/">
              Ideas become systems.
              <br />
              Systems keep changing.
            </a>
            <p>A project archive by Sameer Akhtari.</p>
          </div>
          <div>
            <a
              href="https://github.com/sameerakhtari/projects2.0"
              rel="noopener noreferrer"
            >
              Source on GitHub ↗
            </a>
            <a href="/log">Follow the build log</a>
            <a href="/admin">Owner access</a>
          </div>
          <p class="footer-note">
            Documented states, not live telemetry.
            <br />
            Earlier work stays part of the story.
          </p>
        </footer>
      </body>
    </html>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span class={`status status-${value.toLowerCase().replaceAll(" ", "-")}`}>
      <span aria-hidden="true"></span>
      {value.toLowerCase()}
    </span>
  );
}
export function Tags({ values }: { values: string[] }) {
  return (
    <div class="tags">
      {values.map((v) => (
        <a href={`/projects?technology=${encodeURIComponent(v)}`}>{v}</a>
      ))}
    </div>
  );
}
export function Arrow() {
  return <span aria-hidden="true">↗</span>;
}
export function SectionHeading({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children?: Child;
}) {
  return (
    <div class="section-heading">
      <span class="index-number">{number}</span>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function formatDate(date: string) {
  if (/^\d{4}$/.test(date)) return date;
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    ...(/^\d{4}-\d{2}-\d{2}$/.test(date) ? { day: "numeric" as const } : {}),
    timeZone: "UTC",
  }).format(new Date(date.length === 7 ? `${date}-01` : date));
}
const wrap = (text: string, limit = 22) => {
  const lines = [""];
  for (const word of text.split(" ")) {
    const i = lines.length - 1;
    if (lines[i] && lines[i].length + word.length > limit) lines.push(word);
    else lines[i] += (lines[i] ? " " : "") + word;
  }
  return lines.slice(0, 3);
};

export function Architecture({
  data,
  title,
  dark = false,
}: {
  data: ProjectInput["architecture"];
  title: string;
  dark?: boolean;
}) {
  if (!data.nodes.length) return null;
  const maxColumn = Math.max(...data.nodes.map((n) => n.column));
  const columns = maxColumn + 1;
  const counts = Array.from(
    { length: columns },
    (_, i) => data.nodes.filter((n) => n.column === i).length,
  );
  const height = Math.max(220, Math.max(...counts) * 94 + 40);
  const width = columns * 224 + 20;
  const points = new Map(
    data.nodes.map((n) => {
      const same = data.nodes.filter((x) => x.column === n.column);
      const row = same.indexOf(n);
      return [
        n.key,
        {
          x: 20 + n.column * 224,
          y: (height / (same.length + 1)) * (row + 1) - 28,
        },
      ];
    }),
  );
  return (
    <figure class={`architecture ${dark ? "on-dark" : ""}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${title}: conceptual architecture. Text connections follow below.`}
      >
        <title>{title} — conceptual architecture</title>
        {data.edges.map((e) => {
          const a = points.get(e.from)!,
            b = points.get(e.to)!;
          return (
            <path
              class="connection"
              d={`M${a.x + 180},${a.y + 28} C${a.x + 202},${a.y + 28} ${b.x - 22},${b.y + 28} ${b.x},${b.y + 28}`}
            />
          );
        })}
        {data.nodes.map((n) => {
          const p = points.get(n.key)!;
          return (
            <g>
              <rect x={p.x} y={p.y} width="180" height="58" rx="3" />
              <text class="node-label" x={p.x + 13} y={p.y + 23}>
                {n.label.length > 21 ? n.label.slice(0, 20) + "…" : n.label}
              </text>
              <text class="node-detail" x={p.x + 13} y={p.y + 43}>
                {n.detail.length > 22 ? n.detail.slice(0, 21) + "…" : n.detail}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption>
        Conceptual architecture · <span>roles, not private addresses</span>
      </figcaption>
      <details class="diagram-text">
        <summary>Read the connections</summary>
        <dl class="diagram-roles">
          {data.nodes.map((n) => (
            <div>
              <dt>{n.label}</dt>
              <dd>{n.detail}</dd>
            </div>
          ))}
        </dl>
        <ul>
          {data.edges.map((e) => (
            <li>
              <strong>{data.nodes.find((n) => n.key === e.from)?.label}</strong>{" "}
              → <strong>{data.nodes.find((n) => n.key === e.to)?.label}</strong>
              {e.label && ` · ${e.label}`}
            </li>
          ))}
        </ul>
        {data.nodes
          .filter(
            (n) => !data.edges.some((e) => e.from === n.key || e.to === n.key),
          )
          .map((n) => (
            <p>
              {n.label}: {n.detail}
            </p>
          ))}
      </details>
    </figure>
  );
}

export function ProjectGraph({ projects }: { projects: PublicProject[] }) {
  const connected = projects.filter(
    (p) =>
      p.relationships.length ||
      projects.some((q) => q.relationships.some((r) => r.target === p.slug)),
  );
  if (!connected.length)
    return <p>No project relationships have been published yet.</p>;
  function depth(p: PublicProject, seen = new Set<string>()): number {
    if (seen.has(p.slug)) return 0;
    seen.add(p.slug);
    const parents = p.relationships
      .filter((r) => !["RELATED_TO", "INSPIRED"].includes(r.type))
      .map((r) => connected.find((q) => q.slug === r.target))
      .filter((p): p is PublicProject => !!p);
    return parents.length
      ? Math.min(
          3,
          1 + Math.max(...parents.map((q) => depth(q, new Set(seen)))),
        )
      : 0;
  }
  const depths = new Map(connected.map((p) => [p.slug, depth(p)]));
  const height = Math.max(
    390,
    Math.max(
      ...[0, 1, 2, 3].map(
        (i) => connected.filter((p) => depths.get(p.slug) === i).length,
      ),
    ) *
      112 +
      65,
  );
  const points = new Map(
    connected.map((p) => {
      const col = depths.get(p.slug)!;
      const same = connected.filter((q) => depths.get(q.slug) === col);
      return [p.slug, { x: 20 + col * 238, y: 45 + same.indexOf(p) * 112 }];
    }),
  );
  return (
    <div class="atlas-graph">
      <div class="graph-top">
        <span class="eyebrow">A lineage of connected systems</span>
        <span class="graph-key">
          <i></i> project relationship
        </span>
      </div>
      <svg
        class="lineage-svg"
        viewBox={`0 0 980 ${height}`}
        role="group"
        aria-label="Interactive project relationships. Each project is a link; a text list follows."
      >
        {connected.flatMap((p) =>
          p.relationships.map((r) => {
            const a = points.get(r.target),
              b = points.get(p.slug);
            if (!a || !b) return null;
            return (
              <path
                data-from={r.target}
                data-to={p.slug}
                class={`lineage-edge ${r.type === "RELATED_TO" ? "secondary-edge" : ""}`}
                d={`M${a.x + 198},${a.y + 38} C${a.x + 218},${a.y + 38} ${b.x - 20},${b.y + 38} ${b.x},${b.y + 38}`}
              >
                <title>
                  {p.title} {relationLabels[r.type]}{" "}
                  {projects.find((q) => q.slug === r.target)?.title}
                </title>
              </path>
            );
          }),
        )}
        {connected.map((p) => {
          const a = points.get(p.slug)!;
          return (
            <a
              href={`/projects/${p.slug}`}
              class="graph-node"
              data-node={p.slug}
              aria-label={`Read ${p.title}`}
            >
              <rect x={a.x} y={a.y} width="198" height="79" rx="3" />
              <text class="graph-status" x={a.x + 14} y={a.y + 20}>
                {p.status}
              </text>
              <text x={a.x + 14} y={a.y + 43}>
                {wrap(p.title, 24).map((line, i) => (
                  <tspan x={a.x + 14} dy={i ? "18" : "0"}>
                    {line}
                  </tspan>
                ))}
              </text>
            </a>
          );
        })}
      </svg>
      <details class="graph-list" open>
        <summary>
          Explore as a text list <span>All relationships</span>
        </summary>
        <ul>
          {connected.map((p) => (
            <li>
              <a href={`/projects/${p.slug}`}>{p.title}</a>
              {p.relationships.length ? (
                <ul>
                  {p.relationships.map((r) => (
                    <li>
                      {relationLabels[r.type]}{" "}
                      <a href={`/projects/${r.target}`}>
                        {projects.find((q) => q.slug === r.target)?.title}
                      </a>
                      <p>{r.note}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>An earlier foundation in this lineage.</p>
              )}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
