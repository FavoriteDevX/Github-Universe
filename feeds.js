// ============================================================================
// TECH FEEDS: REAL DATA FOR THE TECH SQUARE BILLBOARDS (SERVER SIDE)
// ============================================================================
// - GitHub: latest commits and open pull requests of famous repositories
//   (public REST API; set GITHUB_TOKEN to raise the rate limit)
// - Big Tech stocks: Finnhub quotes, only when FINNHUB_API_KEY is set
//   (no key = the scoreboard says so; numbers are never made up)
// - Dev trends: Hacker News top stories, Stack Overflow hot questions and
//   Reddit r/programming (public endpoints, no key needed)
// Base URLs can be overridden with env vars (used by the tests).
const GITHUB_API = process.env.GITHUB_API_URL || 'https://api.github.com';
const FINNHUB_API = process.env.FINNHUB_API_URL || 'https://finnhub.io/api/v1';
const HN_API = process.env.HN_API_URL || 'https://hacker-news.firebaseio.com/v0';
const STACK_API = process.env.STACK_API_URL || 'https://api.stackexchange.com/2.3';
const REDDIT_API = process.env.REDDIT_API_URL || 'https://www.reddit.com';

const WATCHED_REPOS = ['torvalds/linux', 'facebook/react', 'microsoft/vscode', 'nodejs/node'];
const PR_REPOS = ['facebook/react', 'microsoft/vscode'];
const STOCKS = [['AAPL', 'Apple'], ['GOOGL', 'Alphabet'], ['NVDA', 'NVIDIA'], ['MSFT', 'Microsoft'], ['META', 'Meta'], ['AMZN', 'Amazon']];
const USER_AGENT = 'GitHubMultiverse/1.0 (+https://github.com/claudecoded/Github-Universe)';

const state = {
  github: { commits: [], pulls: [], updatedAt: null, error: null },
  stocks: { quotes: [], updatedAt: null, error: process.env.FINNHUB_API_KEY ? null : 'Set FINNHUB_API_KEY to show live Nasdaq quotes' },
  trends: { items: [], updatedAt: null, error: null }
};
const lastSeenSha = {};

async function getJson(url, headers = {}) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`${response.status} ${url.split('?')[0]}`);
  return response.json();
}

function decodeEntities(text) {
  return String(text).replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

async function refreshGithub(onHighlight) {
  const headers = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
  try {
    const commits = [];
    for (const repo of WATCHED_REPOS) {
      const list = await getJson(`${GITHUB_API}/repos/${repo}/commits?per_page=3`, headers);
      list.forEach((item) => commits.push({
        repo,
        sha: item.sha.slice(0, 7),
        message: item.commit.message.split('\n')[0].slice(0, 90),
        author: (item.commit.author && item.commit.author.name) || 'unknown',
        date: item.commit.author && item.commit.author.date
      }));
      // A new commit on a famous repo makes the mural flash with fireworks
      if (list[0] && lastSeenSha[repo] && lastSeenSha[repo] !== list[0].sha) onHighlight({ repo, message: list[0].commit.message.split('\n')[0].slice(0, 80) });
      if (list[0]) lastSeenSha[repo] = list[0].sha;
    }
    const pulls = [];
    for (const repo of PR_REPOS) {
      const list = await getJson(`${GITHUB_API}/repos/${repo}/pulls?state=open&per_page=4`, headers);
      list.forEach((item) => pulls.push({ repo, number: item.number, title: item.title.slice(0, 80), author: item.user && item.user.login }));
    }
    commits.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    state.github = { commits: commits.slice(0, 10), pulls: pulls.slice(0, 8), updatedAt: Date.now(), error: null };
  } catch (error) {
    state.github.error = `GitHub API unavailable (${error.message})`;
  }
}

async function refreshStocks() {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return;
  try {
    const quotes = [];
    for (const [symbol, name] of STOCKS) {
      const quote = await getJson(`${FINNHUB_API}/quote?symbol=${symbol}&token=${encodeURIComponent(key)}`);
      if (typeof quote.c === 'number' && quote.c > 0) quotes.push({ symbol, name, price: quote.c, change: quote.d, percent: quote.dp });
    }
    state.stocks = { quotes, updatedAt: Date.now(), error: quotes.length ? null : 'No quotes returned' };
  } catch (error) {
    state.stocks.error = `Stock quotes unavailable (${error.message})`;
  }
}

async function refreshTrends() {
  const items = [];
  const errors = [];
  try {
    const ids = (await getJson(`${HN_API}/topstories.json`)).slice(0, 5);
    for (const id of ids) {
      const story = await getJson(`${HN_API}/item/${id}.json`);
      if (story && story.title) items.push({ source: 'Hacker News', title: story.title.slice(0, 90), score: story.score || 0 });
    }
  } catch (error) { errors.push('Hacker News'); }
  try {
    const hot = await getJson(`${STACK_API}/questions?order=desc&sort=hot&site=stackoverflow&pagesize=5`);
    (hot.items || []).forEach((question) => items.push({ source: 'Stack Overflow', title: decodeEntities(question.title).slice(0, 90), score: question.score || 0, tags: (question.tags || []).slice(0, 3) }));
  } catch (error) { errors.push('Stack Overflow'); }
  try {
    const reddit = await getJson(`${REDDIT_API}/r/programming/hot.json?limit=6`);
    ((reddit.data && reddit.data.children) || []).filter((child) => !child.data.stickied).slice(0, 5)
      .forEach((child) => items.push({ source: 'r/programming', title: child.data.title.slice(0, 90), score: child.data.score || 0 }));
  } catch (error) { errors.push('Reddit'); }
  state.trends = { items, updatedAt: Date.now(), error: errors.length ? `Unavailable: ${errors.join(', ')}` : null };
}

// Starts the refresh loops; calls onUpdate(snapshot) after each refresh
function start({ onUpdate, onHighlight, githubEveryMs = 10 * 60 * 1000, stocksEveryMs = 2 * 60 * 1000, trendsEveryMs = 10 * 60 * 1000 }) {
  const run = (task, every) => {
    const tick = () => task().then(() => onUpdate(snapshot())).catch(() => {});
    tick();
    setInterval(tick, every);
  };
  run(() => refreshGithub(onHighlight), githubEveryMs);
  run(refreshStocks, stocksEveryMs);
  run(refreshTrends, trendsEveryMs);
}

function snapshot() {
  return JSON.parse(JSON.stringify(state));
}

module.exports = { start, snapshot };
