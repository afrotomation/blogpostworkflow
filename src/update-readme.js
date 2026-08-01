const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const DevToClient = require('./devto-client');

// The blog lives on dev.to now; this is the dev.to username, and the
// read API needs no key.
const DEVTO_USERNAME = process.env.DEVTO_USERNAME || 'codenificient';
const MAX_POSTS = 5;

// FIXED LINE HERE 👇
const README_PATH = path.resolve(__dirname, '../profile-repo/README.md');

const START_MARKER = '<!-- BLOG-POST-LIST:START -->';
const END_MARKER = '<!-- BLOG-POST-LIST:END -->';

(async () => {
  try {
    // DEVTO_API_KEY is optional — published posts are public.
    const client = new DevToClient(process.env.DEVTO_API_KEY);
    const posts = await client.fetchPosts(DEVTO_USERNAME, MAX_POSTS);

    if (!posts.length) {
      core.warning('No blog posts found');
      return;
    }

    const formattedPosts = posts.map(post => {
      const date = post.date.toISOString().split('T')[0];
      return `- [${post.title}](${post.url}) _(Published: ${date})_`;
    }).join('\n');

    const readme = fs.readFileSync(README_PATH, 'utf8');

    const startIndex = readme.indexOf(START_MARKER);
    const endIndex = readme.indexOf(END_MARKER);

    if (startIndex === -1 || endIndex === -1) {
      throw new Error('Cannot find BLOG-POST-LIST markers in README.md');
    }

    const before = readme.substring(0, startIndex + START_MARKER.length);
    const after = readme.substring(endIndex);

    const newContent = `${before}\n${formattedPosts}\n${after}`;
    fs.writeFileSync(README_PATH, newContent);

    console.log('✅ README.md updated with latest blog posts');
  } catch (error) {
    core.setFailed(`❌ Failed to update README: ${error.message}`);
  }
})();
