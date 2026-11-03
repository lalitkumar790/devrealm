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
- Build an experimental sampled function call graph from the architecture panel; call sites show their best-effort enclosing function, uniquely named call candidates can jump to their inferred definition, and ambiguous names are listed without forced links. Selecting a candidate also estimates transitive caller impact over the inferred function edges.
- Open a repository's time machine to load its 30 most recent commits and scrub to a revision. Each selected revision rebuilds the interior from that commit's Git tree, showing the directory/file layout as it existed then. Adjacent revisions are compared by file path and blob SHA: added files glow green, modified files amber, and deleted files appear as red wireframe ghosts. A compact delta summary reports added, deleted, modified and unchanged files.
- Enter a repository interior generated from its recursive Git tree: top-level folders become illuminated regions, and you can descend into nested folders with a breadcrumb-style up-one-level control. Files become floating artifacts. A bounded sample of JavaScript/TypeScript, Python, Rust, Go and Java source blobs is scanned for resolvable local imports; matched references appear as amber pathways.
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

DevRealm reads public GitHub profile and repository metadata from the GitHub REST API. It does not request a personal access token or send data to a DevRealm backend. Unauthenticated API limits apply. The activity indicator uses repository `updated_at` metadata, not a full contribution graph. Repository interiors use GitHub's recursive tree endpoint; very large trees may be truncated by GitHub. Architecture insights are calculated only over the sampled source-file set and its resolved local import edges: entry-point candidates use conventional filename and zero-inbound heuristics, hubs use sampled in/out degree, and cycle detection uses strongly connected components. Isolated-module findings therefore mean isolated within this sample, not necessarily in the complete project. The experimental call graph scans sampled function declarations and call-shaped identifier expressions. It links a call only when exactly one sampled function has that name, and reports ambiguous names separately; each candidate receives a best-effort enclosing-function attribution (brace ranges for brace-delimited languages and indentation ranges for Python); nested functions are assigned to the narrowest detected range. Function-level edges are aggregated from those candidates, and transitive caller/callee reachability can be inspected when a candidate is selected. This remains a bounded heuristic, not AST or lexical-scope resolution: expression-bodied functions, unusual formatting, language-specific syntax, regex literals, and same-named functions can cause missed or incorrect relationships. The symbol index scans the same bounded sample of source blobs, uses lightweight declaration patterns, and counts exact identifier occurrences in other sampled files; these are textual references, not AST-resolved call sites or guaranteed semantic usages. Dependency tracing computes transitive upstream and downstream reachability over this same bounded graph; its impact set is the target plus its upstream dependents, not a semantic runtime blast-radius guarantee. Architecture pathways are inferred from up to 24 sampled source blobs (each at most 80 KB) across JavaScript/TypeScript, Python, Rust, Go and Java using lightweight language-specific import matchers. These are partial static hints, not a complete dependency graph, AST analysis, or proof of runtime dependencies; absolute aliases, generated modules, dynamic imports and external packages may not resolve. Source previews fetch individual Git blobs on demand and are capped at 80 KB; binary and oversized files are not previewed. The recent-commit signal samples up to eight authored commits from each of the six most-starred repositories returned by the profile query. Historical browsing is limited to the 30 most recent commits returned by GitHub; each revision loads its tree on demand. Adjacent revision comparisons use file paths and blob SHAs, not line-level patches; up to eight historical tree results are cached in memory during a session. Added and modified markers apply to the selected revision relative to the next older revision; deleted files are represented as wireframe ghosts. Historical snapshots omit import sampling to keep API usage bounded. Private repositories and private contribution data are not accessed.

## Roadmap

- [x] Interactive Three.js galaxy with orbit and zoom
- [x] Procedural language-coloured planetary terrain
- [x] Repository systems, moons, atmospheres and constellation links
- [x] Smooth focus travel and galaxy reset
- [x] Public GitHub profile and repository lookup
- [x] Repository inspection and activity metadata
- [x] First repository interior: map folders and files from the recursive Git tree
- [x] In-world source previews for selected files
- [x] Sampled cross-language local import relationships (JavaScript/TypeScript, Python, Rust, Go and Java)
- [x] Inferred architecture intelligence: entry candidates, dependency hubs, isolated sampled modules, module clusters and circular-dependency detection
- [x] Interactive dependency tracing: transitive upstream/downstream paths, impact set, edge highlighting and unrelated-file dimming
- [x] Sampled symbol index for function/class declarations and cross-file references, with jump-to-source context
- [x] Bounded commit history timeline with revision tree reconstruction
- [x] Adjacent revision tree diffs with in-world added/modified/deleted file markers
- [x] On-demand line-level diffs for selected modified files
- [x] Experimental function call candidates from sampled source, with unique-name resolution and explicit ambiguous-call reporting
- [ ] Rich biome rules from languages, topics and project metadata
- [ ] Shareable world snapshots
- [ ] GitLab, Codeberg and local Git providers
- [ ] Browser integration and visual regression tests

## License

MIT
