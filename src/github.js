const API = "https://api.github.com";
const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };

async function request(path) {
  const response = await fetch(API + path, { headers });
  if (response.status === 404) throw new Error("That GitHub user or resource could not be found.");
  if (response.status === 403 || response.status === 429) throw new Error("GitHub's public API rate limit was reached. Try again later.");
  if (!response.ok) throw new Error(`GitHub returned an error (${response.status}). Please try again.`);
  return response.json();
}

export async function fetchDeveloper(username) {
  const clean = username.trim().replace(/^@/, "");
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(clean)) throw new Error("Enter a valid GitHub username.");
  const [profile, repositories] = await Promise.all([
    request(`/users/${encodeURIComponent(clean)}`),
    request(`/users/${encodeURIComponent(clean)}/repos?per_page=100&sort=updated&type=owner`)
  ]);
  const repos = repositories.filter(repo => !repo.fork).sort((a,b)=>b.stargazers_count-a.stargazers_count);
  return { profile, repositories: repos };
}

export async function fetchRecentCommits(username, repositories) {
  const candidates = repositories.slice(0, 6);
  const batches = await Promise.all(candidates.map(async repo => {
    try {
      const owner = repo.owner?.login || username;
      const commits = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo.name)}/commits?author=${encodeURIComponent(username)}&per_page=8`);
      return commits.map(item => ({
        sha: item.sha,
        message: item.commit?.message?.split("\\n")[0] || "Commit",
        date: item.commit?.author?.date || item.commit?.committer?.date,
        repo: repo.name,
        url: item.html_url
      })).filter(item => item.date);
    } catch {
      return [];
    }
  }));
  return batches.flat().sort((a,b)=>new Date(b.date)-new Date(a.date));
}
