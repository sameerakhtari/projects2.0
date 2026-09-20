import type { Child } from "hono/jsx";
import {
  domains,
  kinds,
  relationLabels,
  relationTypes,
  statuses,
  type AdminProject,
  type ProjectInput,
} from "../content/model";
import { Arrow, Status } from "./shared";
type Row = Record<string, string | number | null>;
const blank: ProjectInput = {
  slug: "",
  title: "",
  subtitle: "",
  summary: "",
  status: "EXPERIMENT",
  domain: "Software",
  kind: "SOFTWARE",
  timeframe: "",
  startYear: null,
  endYear: null,
  featured: false,
  sortOrder: 100,
  nextIteration: "",
  privateNotes: "",
  technologies: [],
  sections: [],
  updates: [],
  links: [],
  relationships: [],
  architecture: { nodes: [], edges: [] },
  media: [],
};
function Field({
  label,
  name,
  value = "",
  type = "text",
  hint,
  wide = false,
  required = false,
  readonly = false,
}: {
  label: string;
  name: string;
  value?: string | number | null;
  type?: string;
  hint?: string;
  wide?: boolean;
  required?: boolean;
  readonly?: boolean;
}) {
  return (
    <label class={wide ? "wide" : ""}>
      {label}
      <input
        name={name}
        data-field={name}
        value={value ?? ""}
        type={type}
        required={required}
        readonly={readonly}
      />
      {hint && <span class="field-hint">{hint}</span>}
    </label>
  );
}
function TextArea({
  label,
  name,
  value = "",
  rows = 4,
  hint,
  wide = true,
}: {
  label: string;
  name: string;
  value?: string;
  rows?: number;
  hint?: string;
  wide?: boolean;
}) {
  return (
    <label class={wide ? "wide" : ""}>
      {label}
      <textarea name={name} data-field={name} rows={rows}>
        {value}
      </textarea>
      {hint && <span class="field-hint">{hint}</span>}
    </label>
  );
}
function Choice({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: readonly string[];
}) {
  return (
    <label>
      {label}
      <select name={name} data-field={name}>
        {options.map((o) => (
          <option value={o} selected={value === o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
function RepeatRow({ children }: { children: Child }) {
  return (
    <div class="repeat-row">
      <div class="form-grid">{children}</div>
      <div class="row-actions">
        <button
          type="button"
          class="secondary"
          data-move="up"
          aria-label="Move entry up"
        >
          ↑ Up
        </button>
        <button
          type="button"
          class="secondary"
          data-move="down"
          aria-label="Move entry down"
        >
          ↓ Down
        </button>
        <button type="button" class="secondary" data-remove>
          Remove entry
        </button>
      </div>
    </div>
  );
}
function SectionRow({ value }: { value?: ProjectInput["sections"][number] }) {
  return (
    <RepeatRow>
      <Field
        label="Section heading"
        name="heading"
        value={value?.heading}
        wide
      />
      <TextArea
        label="Body"
        name="body"
        value={value?.body}
        rows={7}
        hint="Markdown is supported. Raw HTML and embedded images are disabled; add images in Media."
      />
    </RepeatRow>
  );
}
function UpdateRow({ value }: { value?: ProjectInput["updates"][number] }) {
  return (
    <RepeatRow>
      <Field
        label="Date"
        name="date"
        value={value?.date}
        hint="YYYY, YYYY-MM or YYYY-MM-DD"
      />
      <Choice
        label="Entry type"
        name="kind"
        value={value?.kind ?? "NOTE"}
        options={["MILESTONE", "NOTE", "EXPERIMENT", "PLANNED"]}
      />
      <Field label="Title" name="title" value={value?.title} wide />
      <TextArea label="What changed?" name="body" value={value?.body} />
    </RepeatRow>
  );
}
function LinkRow({ value }: { value?: ProjectInput["links"][number] }) {
  return (
    <RepeatRow>
      <Field label="Link label" name="label" value={value?.label} />
      <Field label="HTTPS URL" name="url" type="url" value={value?.url} />
    </RepeatRow>
  );
}
function RelationRow({
  value,
  projects,
  current,
}: {
  value?: ProjectInput["relationships"][number];
  projects: AdminProject[];
  current: string;
}) {
  return (
    <RepeatRow>
      <Choice
        label="Relationship"
        name="type"
        value={value?.type ?? "RELATED_TO"}
        options={relationTypes}
      />
      <label>
        Related project
        <select data-field="target" name="target">
          <option value="">Choose a project</option>
          {projects
            .filter((p) => p.slug !== current)
            .map((p) => (
              <option value={p.slug} selected={value?.target === p.slug}>
                {p.title}
              </option>
            ))}
        </select>
      </label>
      <TextArea
        label="Why are they connected?"
        name="note"
        value={value?.note}
        rows={2}
      />
      <span class="field-hint wide">
        Read as: this project {relationLabels[value?.type ?? "RELATED_TO"]} the
        selected project.
      </span>
    </RepeatRow>
  );
}
function NodeRow({
  value,
}: {
  value?: ProjectInput["architecture"]["nodes"][number];
}) {
  return (
    <RepeatRow>
      <Field
        label="Node key"
        name="key"
        value={value?.key}
        hint="A short unique key, e.g. home-server"
      />
      <Field label="Label" name="label" value={value?.label} />
      <Field label="Detail" name="detail" value={value?.detail} />
      <Choice
        label="Diagram column"
        name="column"
        value={String(value?.column ?? 0)}
        options={["0", "1", "2", "3"]}
      />
    </RepeatRow>
  );
}
function EdgeRow({
  value,
}: {
  value?: ProjectInput["architecture"]["edges"][number];
}) {
  return (
    <RepeatRow>
      <Field label="From node key" name="from" value={value?.from} />
      <Field label="To node key" name="to" value={value?.to} />
      <Field label="Connection label" name="label" value={value?.label} wide />
    </RepeatRow>
  );
}
function MediaRow({
  value,
  available,
}: {
  value?: ProjectInput["media"][number];
  available: Row[];
}) {
  return (
    <RepeatRow>
      <label class="wide">
        Uploaded image
        <select name="id" data-field="id">
          <option value="">Choose an image</option>
          {available.map((m) => (
            <option value={String(m.id)} selected={value?.id === m.id}>
              {String(m.alt)} · {String(m.id).slice(0, 8)}
            </option>
          ))}
        </select>
      </label>
      <Field
        label="Alt text"
        name="alt"
        value={value?.alt}
        wide
        hint="Describe the useful content of the image."
      />
      <TextArea
        label="Caption (optional)"
        name="caption"
        value={value?.caption}
        rows={2}
      />
    </RepeatRow>
  );
}
function Repeater({
  id,
  label,
  children,
  template,
}: {
  id: string;
  label: string;
  children: Child;
  template: Child;
}) {
  return (
    <>
      <div data-list={id}>{children}</div>
      <template id={`template-${id}`}>{template}</template>
      <button type="button" class="secondary" data-add={id}>
        + {label}
      </button>
    </>
  );
}

export function Dashboard({
  projects,
  audit,
  csrf,
}: {
  projects: AdminProject[];
  audit: Row[];
  csrf: string;
}) {
  const sorted = [...projects].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  return (
    <div class="page admin-page" data-csrf={csrf}>
      <div class="admin-heading">
        <div>
          <p class="eyebrow">Owner workspace</p>
          <h1>Keep the story current.</h1>
          <p>Draft changes stay private until you publish them.</p>
        </div>
        <div class="admin-actions">
          <a class="button secondary" href="/api/admin/export">
            Download content backup
          </a>
          <a class="button" href="/admin/projects/new">
            New project +
          </a>
        </div>
      </div>
      <div class="stats-row">
        <div>
          <strong>{projects.length}</strong>
          <span>project records</span>
        </div>
        <div>
          <strong>
            {projects.filter((p) => p.publishedRevisionId).length}
          </strong>
          <span>published</span>
        </div>
        <div>
          <strong>
            {
              projects.filter(
                (p) => p.draftRevisionId !== p.publishedRevisionId,
              ).length
            }
          </strong>
          <span>unpublished drafts</span>
        </div>
        <div>
          <strong>
            {
              projects.filter((p) =>
                ["EVOLVING", "IN PROGRESS"].includes(p.status),
              ).length
            }
          </strong>
          <span>active projects</span>
        </div>
      </div>
      <label class="admin-search">
        Find a project
        <input
          type="search"
          id="admin-search"
          placeholder="Search titles or slugs…"
        />
      </label>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>State</th>
              <th>Publication</th>
              <th>Last edited</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr data-admin-search={`${p.title} ${p.slug}`.toLowerCase()}>
                <td>
                  <a href={`/admin/projects/${p.id}`}>{p.title}</a>
                  <small>/{p.slug}</small>
                </td>
                <td>
                  <Status value={p.status} />
                </td>
                <td>
                  {p.publishedRevisionId ? "Published" : "Private draft"}
                  {p.publishedRevisionId &&
                    p.publishedRevisionId !== p.draftRevisionId && (
                      <small>Draft changes waiting</small>
                    )}
                </td>
                <td>{p.updatedAt.slice(0, 10)}</td>
                <td>
                  <a
                    href={`/admin/projects/${p.id}`}
                    aria-label={`Edit ${p.title}`}
                  >
                    Edit ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {projects.length === 0 && (
        <div class="admin-empty">
          No projects yet. Create your first record.
        </div>
      )}
      <section>
        <h2>Recent activity</h2>
        <AuditTable rows={audit.slice(0, 8)} />
        <p class="backup-note">
          Content backups contain drafts, private notes and the media manifest.
          Store them privately. Download original images from Media; R2 object
          backups are documented in the deployment guide.
        </p>
        <a href="/admin/audit">
          View all activity <Arrow />
        </a>
      </section>
    </div>
  );
}

export function Editor({
  project,
  projects,
  available,
  csrf,
}: {
  project?: AdminProject;
  projects: AdminProject[];
  available: Row[];
  csrf: string;
}) {
  const p = project ?? blank;
  return (
    <div class="page admin-page">
      <div class="admin-heading">
        <div>
          <a class="back-link" href="/admin">
            ← Project records
          </a>
          <h1>{project ? "Edit the record." : "Start a new record."}</h1>
          <p>
            {project?.publishedRevisionId
              ? "The published version stays live while you edit."
              : "This record is private until you publish it."}
          </p>
        </div>
        {project && <Status value={p.status} />}
      </div>
      <div id="editor-message" class="notice" role="status" hidden></div>
      <div class="editor-layout">
        <nav class="editor-nav" aria-label="Editor sections">
          <a href="#identity">Identity</a>
          <a href="#writing">Case study</a>
          <a href="#updates">Build log</a>
          <a href="#relationships">Relationships</a>
          <a href="#architecture">Architecture</a>
          <a href="#links">Links</a>
          <a href="#media">Media</a>
          <a href="#private">Private notes</a>
        </nav>
        <form
          id="project-editor"
          class="editor-form"
          data-id={project?.id ?? ""}
          data-version={project?.version ?? 0}
          data-csrf={csrf}
          data-slug={p.slug}
        >
          <section class="editor-panel" id="identity">
            <h2>Project identity</h2>
            <div class="form-grid">
              <Field label="Title" name="title" value={p.title} required wide />
              <Field
                label="Slug"
                name="slug"
                value={p.slug}
                required
                readonly={!!project?.publishedAt}
                hint={
                  project?.publishedAt
                    ? "Published URLs are permanent."
                    : "Lowercase letters, numbers and hyphens."
                }
              />
              <Field label="Subtitle" name="subtitle" value={p.subtitle} />
              <TextArea
                label="Summary"
                name="summary"
                value={p.summary}
                rows={3}
                hint="20–650 characters. Explain what it is, without overstating the result."
              />
              <Choice
                label="Project state"
                name="status"
                value={p.status}
                options={statuses}
              />
              <Choice
                label="Domain"
                name="domain"
                value={p.domain}
                options={domains}
              />
              <Choice
                label="Material"
                name="kind"
                value={p.kind}
                options={kinds}
              />
              <Field
                label="Timeframe label"
                name="timeframe"
                value={p.timeframe}
                required
                hint="For example: 2026 — ongoing, or Earlier experiment"
              />
              <Field
                label="Start year (if known)"
                name="startYear"
                type="number"
                value={p.startYear}
              />
              <Field
                label="End year (if applicable)"
                name="endYear"
                type="number"
                value={p.endYear}
              />
              <Field
                label="Technologies"
                name="technologies"
                value={p.technologies.join(", ")}
                wide
                hint="Comma-separated names. Keep names consistent across projects."
              />
              <Field
                label="Display order"
                name="sortOrder"
                type="number"
                value={p.sortOrder}
                hint="Lower numbers appear first."
              />
              <label class="check-field">
                <input type="checkbox" name="featured" checked={p.featured} />
                Feature this project
              </label>
            </div>
          </section>
          <section class="editor-panel" id="writing">
            <h2>The case study</h2>
            <Repeater
              id="sections"
              label="Add a section"
              template={<SectionRow />}
            >
              {p.sections.map((value) => (
                <SectionRow value={value} />
              ))}
            </Repeater>
            <div class="form-grid">
              <TextArea
                label="Next iteration"
                name="nextIteration"
                value={p.nextIteration}
                hint="An intention, not a claim of completed work."
              />
            </div>
          </section>
          <section class="editor-panel" id="updates">
            <h2>Build log</h2>
            <Repeater
              id="updates"
              label="Add an update"
              template={<UpdateRow />}
            >
              {p.updates.map((value) => (
                <UpdateRow value={value} />
              ))}
            </Repeater>
          </section>
          <section class="editor-panel" id="relationships">
            <h2>Project relationships</h2>
            <Repeater
              id="relationships"
              label="Connect a project"
              template={<RelationRow projects={projects} current={p.slug} />}
            >
              {p.relationships.map((value) => (
                <RelationRow
                  value={value}
                  projects={projects}
                  current={p.slug}
                />
              ))}
            </Repeater>
          </section>
          <section class="editor-panel" id="architecture">
            <h2>Architecture</h2>
            <p class="field-hint">
              Use semantic names such as ROUTER and HOME SERVER. Node keys
              connect the diagram; columns run from left to right.
            </p>
            <details open={p.architecture.nodes.length > 0}>
              <summary>Nodes ({p.architecture.nodes.length})</summary>
              <Repeater id="nodes" label="Add a node" template={<NodeRow />}>
                {p.architecture.nodes.map((value) => (
                  <NodeRow value={value} />
                ))}
              </Repeater>
            </details>
            <details open={p.architecture.edges.length > 0}>
              <summary>Connections ({p.architecture.edges.length})</summary>
              <Repeater
                id="edges"
                label="Add a connection"
                template={<EdgeRow />}
              >
                {p.architecture.edges.map((value) => (
                  <EdgeRow value={value} />
                ))}
              </Repeater>
            </details>
          </section>
          <section class="editor-panel" id="links">
            <h2>Source & related links</h2>
            <Repeater id="links" label="Add a link" template={<LinkRow />}>
              {p.links.map((value) => (
                <LinkRow value={value} />
              ))}
            </Repeater>
          </section>
          <section class="editor-panel" id="media">
            <h2>Images from the build</h2>
            <Repeater
              id="media"
              label="Attach an uploaded image"
              template={<MediaRow available={available} />}
            >
              {p.media.map((value) => (
                <MediaRow value={value} available={available} />
              ))}
            </Repeater>
            {project ? (
              <div class="media-upload">
                <h3>Upload an image</h3>
                <p class="field-hint">
                  PNG, JPEG or WebP, up to 15 MB. Photos are resized to at most
                  4 megapixels and converted to PNG before upload. Review
                  screenshots for private information.
                </p>
                <div class="form-grid">
                  <label>
                    File
                    <input
                      type="file"
                      id="image-file"
                      accept="image/png,image/jpeg,image/webp"
                    />
                  </label>
                  <label>
                    Alt text
                    <input id="image-alt" maxlength={400} />
                  </label>
                </div>
                <button type="button" class="secondary" id="upload-image">
                  Upload & attach
                </button>
                <p id="upload-status" class="field-hint" role="status"></p>
              </div>
            ) : (
              <p class="notice">
                Save the first draft to enable image uploads.
              </p>
            )}
          </section>
          <section class="editor-panel" id="private">
            <h2>Private notes</h2>
            <TextArea
              label="Notes for the owner"
              name="privateNotes"
              value={p.privateNotes}
              hint="These notes are excluded from public pages and APIs. They are included in private content backups."
              rows={5}
            />
          </section>
          <div class="editor-toolbar">
            <span class="save-status" id="save-status" aria-live="polite">
              {project ? "Saved draft loaded." : "Not saved yet."}
            </span>
            <button type="submit">Save draft</button>
            {project && (
              <>
                <a
                  class="button secondary"
                  id="preview-draft"
                  href={`/admin/preview/${project.id}`}
                  target="_blank"
                  rel="noopener"
                >
                  Preview ↗
                </a>
                <button type="button" class="secondary" data-command="publish">
                  Publish saved draft
                </button>
              </>
            )}
          </div>
        </form>
      </div>
      {project && (
        <section class="danger-zone" data-id={project.id}>
          <h2>Publication & removal</h2>
          <p>
            Unpublishing removes the public record and its images. Delete is
            available only after unpublishing. Both actions require the exact
            slug.
          </p>
          <div class="admin-actions">
            <label>
              Type <strong>{p.slug}</strong>
              <input id="confirm-slug" autocomplete="off" spellcheck={false} />
            </label>
            {project.publishedRevisionId && (
              <button type="button" class="secondary" data-command="unpublish">
                Unpublish
              </button>
            )}
            <button type="button" class="danger" data-command="delete">
              Delete project
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
export function AuditTable({ rows }: { rows: Row[] }) {
  return (
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Time (UTC)</th>
            <th>Action</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr>
              <td>{String(r.created_at).replace("T", " ").slice(0, 19)}</td>
              <td>{String(r.action)}</td>
              <td>{String(r.detail)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p class="admin-empty">No recorded activity.</p>}
    </div>
  );
}
export function AuditPage({ rows }: { rows: Row[] }) {
  return (
    <div class="page admin-page">
      <div class="admin-heading">
        <div>
          <p class="eyebrow">Private activity history</p>
          <h1>A record of edits.</h1>
          <p>Content changes, publication and media actions.</p>
        </div>
        <a class="button secondary" href="/api/admin/export">
          Download content backup
        </a>
      </div>
      <AuditTable rows={rows} />
      {rows.length === 50 && (
        <a
          class="button secondary"
          href={`/admin/audit?before=${encodeURIComponent(`${rows.at(-1)!.created_at}~${rows.at(-1)!.id}`)}`}
        >
          Earlier activity
        </a>
      )}
    </div>
  );
}
export function MediaPage({ media, csrf }: { media: Row[]; csrf: string }) {
  return (
    <div class="page admin-page" data-csrf={csrf}>
      <div class="admin-heading">
        <div>
          <p class="eyebrow">Project images</p>
          <h1>From the builds.</h1>
          <p>
            Upload images from a project editor. Public access follows the
            published revision.
          </p>
        </div>
      </div>
      <div id="media-message" role="status"></div>
      <div class="media-admin-grid">
        {media.map((m) => (
          <article class="media-admin-card">
            <img
              src={`/api/admin/media/${m.id}`}
              alt={String(m.alt)}
              width={Number(m.width)}
              height={Number(m.height)}
              loading="lazy"
            />
            <p>{String(m.alt)}</p>
            <small>
              {String(m.project_title)} · {m.width} × {m.height} ·{" "}
              {Math.ceil(Number(m.bytes) / 1024)} KB
            </small>
            <div class="admin-actions">
              <a
                class="button secondary"
                href={`/api/admin/media/${m.id}?download=1`}
              >
                Download
              </a>
              <button
                type="button"
                class="secondary"
                data-delete-media={String(m.id)}
              >
                Delete unused image
              </button>
            </div>
          </article>
        ))}
      </div>
      {media.length === 0 && (
        <div class="admin-empty">
          <h2>No uploaded images yet.</h2>
          <p>
            Open a project, save its first draft, then use the Media section.
          </p>
        </div>
      )}
    </div>
  );
}
