/**
 * Tiny demo server for the Blog Post Workflow GitHub Action.
 *
 * Serves a static landing page at /, plus two API routes the page uses:
 *   GET /api/health           — liveness probe (Coolify, Docker)
 *   GET /api/preview?host=…   — fetches public posts from a dev.to
 *                               publication and renders the same markdown
 *                               snippet the GitHub Action would write into
 *                               your README.
 *
 * The Action itself still works exactly as before — this server is only
 * here so the project has somewhere to point a domain at.
 */
require('dotenv').config();

const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || process.env.port || 9000;
const DEVTO_API_KEY = process.env.DEVTO_API_KEY;

app.use(express.static('public'));

app.get('/api/health', (_req, res) => {
	res.status(200).json({ status: 'ok' });
});


function escapeMarkdown(text) {
	if (!text) return '';
	return String(text).replace(/[\\`*_{}\[\]()#+\-.!|<>]/g, (c) => '\\' + c);
}

/** Render the same `* [title](url)` list the Action emits. */
function renderMarkdown(posts) {
	return posts
		.map((p) => `* [${escapeMarkdown(p.title)}](${p.url})`)
		.join('\n');
}

app.get('/api/preview', async (req, res) => {
	// `host` is kept as the query-param name for backwards compatibility with
	// the landing page, but under dev.to it is a username, not a publication
	// domain. `username` is accepted as the clearer alias.
	const username = String(req.query.username || req.query.host || '').trim();
	const max = Math.min(Math.max(Number(req.query.max) || 5, 1), 20);

	if (!username) {
		return res.status(400).json({ error: 'username query param is required (e.g., codenificient)' });
	}

	try {
		const headers = { accept: 'application/vnd.forem.api-v1+json' };
		// Published posts are public; a key is only needed for drafts.
		if (DEVTO_API_KEY) headers['api-key'] = DEVTO_API_KEY;

		const upstream = await fetch(
			`https://dev.to/api/articles?username=${encodeURIComponent(username)}&per_page=${max}`,
			{ headers },
		);

		if (!upstream.ok) {
			const text = await upstream.text();
			return res.status(502).json({ error: `dev.to upstream ${upstream.status}: ${text.slice(0, 200)}` });
		}

		const articles = await upstream.json();
		if (!Array.isArray(articles) || articles.length === 0) {
			return res.status(404).json({ error: `No dev.to posts found for user '${username}'` });
		}

		const posts = articles.slice(0, max).map((a) => ({
			title: a.title,
			slug: a.slug,
			url: a.url,
			brief: a.description || '',
			publishedAt: a.published_at,
			readTimeInMinutes: a.reading_time_minutes,
			tags: (a.tag_list || []).map((name) => ({ name })),
			coverImage: { url: a.cover_image || a.social_image || '' },
		}));

		res.json({
			publication: {
				id: username,
				title: articles[0].user ? articles[0].user.name : username,
				url: `https://dev.to/${username}`,
			},
			posts,
			markdown: renderMarkdown(posts),
		});
	} catch (err) {
		res.status(500).json({ error: err && err.message ? err.message : String(err) });
	}
});

app.listen(PORT, '0.0.0.0', () => {
	console.log(`blog-post-workflow demo server on :${PORT}`);
});
