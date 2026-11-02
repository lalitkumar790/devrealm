# DevRealm

**A living 3D universe generated from your public GitHub work.**

DevRealm turns repositories into explorable planets and groups them into systems. Programming languages influence planetary palettes and terrain; repository topics and shared languages create constellation links; recent repository updates add activity signals.

## Current experience

- Full-screen Three.js universe with orbit, zoom, starfield, atmospheric lighting and subtle nebulae.
- Procedurally displaced, vertex-coloured planetary surfaces. Language families use distinct terrain palettes.
- Repository systems are spatially clustered; shared languages and topics form constellation links.
- Planets have atmospheres, drifting cloud shells, orbital rings, moons and labels.
- Click a planet to inspect its repository and smoothly travel toward it. Reset returns to galaxy view.
- Select a file artifact to preview its actual Git blob source in an in-world code panel (80 KB preview cap; binary/oversized files link out to GitHub).
- Enter a repository interior generated from its recursive Git tree: top-level folders become illuminated regions, and you can descend into nested folders with a breadcrumb-style up-one-level control. Files become floating artifacts. A small sample of JavaScript/TypeScript source blobs is scanned for resolvable relative imports; matched references appear as amber pathways.
- Active repository metadata adds a visual activity halo.
- Search any public GitHub username; sample universe works without credentials.
- Minimal in-world HUD keeps the 3D scene central.

## Run locally

The app is a static site using browser ES modules and Three.js from jsDelivr. No build step is required.

```bash
python -m http.server 8000
```

Open http://localhost:8000. WebGL and network access to jsDelivr and api.github.com are required.

## Data and limitations

DevRealm reads public GitHub profile and repository metadata from the GitHub REST API. It does not request a personal access token or send data to a DevRealm backend. Unauthenticated API limits apply. The activity indicator uses repository `updated_at` metadata, not a full contribution graph. Repository interiors use GitHub's recursive tree endpoint; very large trees may be truncated by GitHub. Import pathways are inferred from up to 12 sampled JavaScript/TypeScript files and a lightweight import/require matcher. They are not a complete dependency graph, AST analysis, or proof of runtime dependencies. Source previews fetch individual Git blobs on demand and are capped at 80 KB; binary and oversized files are not previewed. The recent-commit signal samples up to eight authored commits from each of the six most-starred repositories returned by the profile query. Private repositories and private contribution data are not accessed.

## Roadmap

- [x] Interactive Three.js galaxy with orbit and zoom
- [x] Procedural language-coloured planetary terrain
- [x] Repository systems, moons, atmospheres and constellation links
- [x] Smooth focus travel and galaxy reset
- [x] Public GitHub profile and repository lookup
- [x] Repository inspection and activity metadata
- [x] First repository interior: map folders and files from the recursive Git tree
- [x] In-world source previews for selected files
- [ ] Deeper module navigation and language-aware source relationships
- [ ] Time-lapse universe driven by repository history
- [ ] Rich biome rules from languages, topics and project metadata
- [ ] Shareable world snapshots
- [ ] GitLab, Codeberg and local Git providers
- [ ] Browser integration and visual regression tests

## License

MIT
