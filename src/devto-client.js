const core = require('@actions/core');
const fetch = require('node-fetch');

/**
 * dev.to client for fetching blog posts.
 *
 * Replaces the Hashnode GraphQL client: the blog moved to dev.to, and dev.to's
 * read API is public — no key, no GraphQL. Deliberately exposes the same
 * `fetchPosts()` shape the Hashnode client did so every caller and all the
 * downstream formatting keeps working unchanged.
 */
class DevToClient {
	/**
	 * @param {string} [apiKey] Optional dev.to API key. Only needed to read
	 *   unpublished drafts; published posts are public, so this is normally
	 *   omitted.
	 */
	constructor(apiKey) {
		this.apiKey = apiKey;
		this.endpoint = 'https://dev.to/api';
	}

	/**
	 * Fetch published posts for a dev.to username.
	 * @param {string} username - dev.to username (e.g. "codenificient")
	 * @param {number} maxPosts - Maximum number of posts to return
	 * @returns {Promise<Array>} Posts in the shape the workflow expects
	 */
	async fetchPosts(username, maxPosts = 5) {
		try {
			// per_page is capped at 1000 by dev.to; asking for a few extra
			// leaves room for the caller's own filtering, as before.
			const perPage = Math.min(Math.max(maxPosts, 10), 1000);
			const url = `${this.endpoint}/articles?username=${encodeURIComponent(username)}&per_page=${perPage}`;

			const headers = { accept: 'application/vnd.forem.api-v1+json' };
			if (this.apiKey) {
				headers['api-key'] = this.apiKey;
			}

			const response = await fetch(url, { headers });

			if (!response.ok) {
				throw new Error(`dev.to API request failed: ${response.status} ${response.statusText}`);
			}

			const posts = await response.json();

			if (!Array.isArray(posts) || posts.length === 0) {
				core.warning(`No posts found for dev.to user: ${username}`);
				return [];
			}

			return posts.slice(0, maxPosts).map((post) => ({
				title: post.title,
				url: post.url ?? post.canonical_url,
				description: post.description || '',
				date: new Date(post.published_at ?? post.published_timestamp),
				categories: Array.isArray(post.tag_list) ? post.tag_list : [],
				coverImage: post.cover_image || post.social_image || '',
				totalReactions: post.public_reactions_count ?? post.positive_reactions_count ?? 0,
				responseCount: post.comments_count ?? 0,
			}));
		} catch (error) {
			core.error(`Failed to fetch dev.to posts: ${error.message}`);
			throw error;
		}
	}
}

module.exports = DevToClient;
