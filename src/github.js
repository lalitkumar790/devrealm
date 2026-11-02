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
