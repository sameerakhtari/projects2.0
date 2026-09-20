import MarkdownIt from "markdown-it";
const md = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
  breaks: false,
});
md.disable(["image"]);
md.validateLink = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return /^\/[a-z0-9\-/#?=&%]*$/i.test(url) && !url.startsWith("//");
  }
};
const defaultLink = md.renderer.rules.link_open;
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet("rel", "noopener noreferrer");
  return defaultLink
    ? defaultLink(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options);
};
export function renderMarkdown(source: string): string {
  return md.render(source);
}
