#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: build-cloudflare-pages.sh [source_dir] [output_dir]

Build a Cloudflare Pages publish directory from tracked page folders.

Defaults:
  source_dir: pages
  output_dir: .deploy/cloudflare-pages

Environment:
  DEPLOY_PAGES_SOURCE   Source directory, default: pages
  DEPLOY_PAGES_BUILD_DIR
                        Build output directory, default: .deploy/cloudflare-pages
  DEPLOY_PAGES_DOMAIN   Public domain for generated directory copy, default: docs.stanleywind.org
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

source_dir="${1:-${DEPLOY_PAGES_SOURCE:-pages}}"
output_dir="${2:-${DEPLOY_PAGES_BUILD_DIR:-.deploy/cloudflare-pages}}"
domain="${DEPLOY_PAGES_DOMAIN:-docs.stanleywind.org}"

if [[ ! -d "$source_dir" ]]; then
  echo "Source directory does not exist: $source_dir" >&2
  exit 1
fi

slugs=()
while IFS= read -r slug; do
  slugs+=("$slug")
done < <(
  find "$source_dir" -mindepth 2 -maxdepth 2 -type f -name index.html \
    -exec dirname {} \; \
    | while IFS= read -r page_dir; do
      [[ -f "$page_dir/.hidden" ]] && continue
      printf '%s\n' "$page_dir"
    done \
    | xargs -n 1 basename \
    | sort
)

if [[ "${#slugs[@]}" -eq 0 ]]; then
  echo "No deployable page folders found in: $source_dir" >&2
  exit 1
fi

case "$output_dir" in
  "" | "." | "/")
    echo "Refusing unsafe output directory: $output_dir" >&2
    exit 1
    ;;
esac

rm -rf "$output_dir"
mkdir -p "$output_dir"

cp -R "$source_dir"/. "$output_dir"/
find "$output_dir" \( -name '.DS_Store' -o -name '.git' -o -name 'node_modules' \) -prune -exec rm -rf {} +

index_file="$output_dir/index.html"

{
  cat <<HTML
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Docs Directory</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f7f4;
      --paper: #ffffff;
      --ink: #202124;
      --muted: #667085;
      --line: #d9ddd3;
      --accent: #176b72;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.6;
    }

    main {
      max-width: 1040px;
      margin: 0 auto;
      padding: 48px 24px 72px;
    }

    header { margin-bottom: 28px; }

    h1 {
      margin: 0 0 8px;
      font-size: clamp(34px, 7vw, 64px);
      line-height: 1;
      letter-spacing: 0;
    }

    p {
      margin: 0;
      color: var(--muted);
      font-size: 17px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 14px;
    }

    a.card {
      display: block;
      min-height: 104px;
      padding: 18px;
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 8px;
      color: inherit;
      text-decoration: none;
      transition: border-color 140ms ease, transform 140ms ease;
    }

    a.card:hover {
      border-color: var(--accent);
      transform: translateY(-1px);
    }

    .name {
      display: block;
      margin-bottom: 8px;
      color: var(--accent);
      font-size: 19px;
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    .url {
      display: block;
      color: var(--muted);
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 13px;
      overflow-wrap: anywhere;
    }

    footer {
      margin-top: 28px;
      color: var(--muted);
      font-size: 14px;
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Docs Directory</h1>
      <p>Published static pages on ${domain}.</p>
    </header>

    <section class="grid" aria-label="Published pages">
HTML

  for slug in "${slugs[@]}"; do
    printf '      <a class="card" href="/%s/"><span class="name">%s</span><span class="url">/%s/</span></a>\n' "$slug" "$slug" "$slug"
  done

  cat <<HTML
    </section>

    <footer>Generated from ${source_dir}.</footer>
  </main>
</body>
</html>
HTML
} > "$index_file"

echo "Built ${output_dir} with ${#slugs[@]} pages."
