# DevRealm

**Turn your GitHub activity into a living developer universe.**

DevRealm is an interactive visualization of a developer's public work. Repositories become places to explore, programming languages shape the world, and project metadata gives each world its own character.

> Early prototype: this repository is the foundation of DevRealm. The first milestone focuses on a fast, dependency-light world explorer that runs locally and can be deployed as a static site.

## Current prototype

- Search any public GitHub username.
- Fetch public profile and repository metadata using GitHub's public REST API.
- Generate a procedural world from the repositories and their primary languages.
- Inspect repositories, open their GitHub pages, and explore the technology distribution.
- Pan and zoom the map; use a sample world without an API key.
- Responsive interface with accessible controls and reduced-motion support.

## Run locally

No build step or package installation is required.

```bash
python -m http.server 8000
```

Open http://localhost:8000.

You can also open `index.html` directly, though some browsers restrict network requests from local files.

## Data and privacy

The prototype reads public GitHub profile and repository data from `api.github.com`. It does not request a personal access token, store credentials, or send profile data to a DevRealm server. GitHub's unauthenticated API rate limits apply. The journey panel samples up to eight recent authored commits from each of the six most-starred repositories returned by the profile query; it is not a complete contribution calendar. Private repositories and private contribution data are not accessed.

## Roadmap

- [x] Procedural world renderer and sample dataset
- [x] Public GitHub profile/repository lookup
- [x] Repository inspection and language breakdown
- [x] Recent authored-commit timeline (sampled across up to six repositories)
- [ ] Full contribution history and time-travel timeline
- [ ] Repository relationships and dependency constellations
- [ ] Shareable world snapshots
- [ ] Multiple source providers (GitLab, Codeberg, local Git)
- [x] Zero-dependency Node test suite for world generation and hit testing
- [ ] Browser integration tests and deployment workflow

## Project structure

```
.
├── index.html
├── styles.css
├── package.json
├── src/
│   ├── app.js
│   ├── data.js
│   ├── github.js
│   └── world.js
└── README.md
```

## License

MIT
