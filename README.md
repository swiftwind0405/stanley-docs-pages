# stanley-docs-pages

Static documentation pages for <https://docs.stanleywind.org/>.

## Structure

```text
pages/
  <slug>/
    index.html
scripts/
  build-cloudflare-pages.sh
```

`pages/<slug>/index.html` is the source for each published page.

`pages/compound-engineering/` is generated from the [compound-engineering-plugin](https://github.com/EveryInc/compound-engineering-plugin) repo:

```bash
# in compound-engineering-plugin checkout
bun run docs:build-skills-site:stanley
```

Set `STANLEY_DOCS_PAGES` if your stanley-docs-pages checkout is not at `~/Workspace/projects/stanley-docs-pages`.

## Build

```bash
bash scripts/build-cloudflare-pages.sh
```

The build output is:

```text
.deploy/cloudflare-pages
```

Cloudflare Pages uses that directory as the publish output.

## Deploy

Cloudflare Pages is connected to this GitHub repository. Push to the production branch to deploy.
