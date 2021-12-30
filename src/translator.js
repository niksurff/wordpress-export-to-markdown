const turndown = require('turndown');
const turndownPluginGfm = require('turndown-plugin-gfm');

function initTurndownService() {
	const turndownService = new turndown({
		headingStyle: 'atx',
		bulletListMarker: '*',
		codeBlockStyle: 'fenced'
	});

	turndownService.use(turndownPluginGfm.tables);

	// preserve embedded tweets
	turndownService.addRule('tweet', {
		filter: node => node.nodeName === 'BLOCKQUOTE' && node.getAttribute('class') === 'twitter-tweet',
		replacement: (content, node) => '\n\n' + node.outerHTML
	});

	// preserve embedded codepens
	turndownService.addRule('codepen', {
		filter: node => {
			// codepen embed snippets have changed over the years
			// but this series of checks should find the commonalities
			return (
				['P', 'DIV'].includes(node.nodeName) &&
				node.attributes['data-slug-hash'] &&
				node.getAttribute('class') === 'codepen'
			);
		},
		replacement: (content, node) => '\n\n' + node.outerHTML
	});

	// preserve embedded scripts (for tweets, codepens, gists, etc.)
	turndownService.addRule('script', {
		filter: 'script',
		replacement: (content, node) => {
			let before = '\n\n';
			if (node.previousSibling && node.previousSibling.nodeName !== '#text') {
				// keep twitter and codepen <script> tags snug with the element above them
				before = '\n';
			}
			const html = node.outerHTML.replace('async=""', 'async');
			return before + html + '\n\n';
		}
	});

	// preserve iframes (common for embedded audio/video)
	turndownService.addRule('iframe', {
		filter: 'iframe',
		replacement: (content, node) => {
			const html = node.outerHTML.replace('allowfullscreen=""', 'allowfullscreen');
			return '\n\n' + html + '\n\n';
		}
	});

	// remove links around images
	/* turndownService.addRule('aImg', {
		filter: node => node.nodeName === 'A' && node.firstChild.nodeName === 'IMG',
		replacement: (content, node) => {
			const img = node.firstChild;
			const html = `<img src="${img.getAttribute('src')}">`;
			return html;
		}
	}); */

	turndownService.addRule('gallery', {
		filter: node =>
			node.nodeName === 'UL' &&
			node.firstChild.nodeName === 'LI' &&
			node.firstChild.firstChild.nodeName === 'FIGURE' &&
			node.firstChild.firstChild.firstChild.nodeName === 'A' &&
			node.firstChild.firstChild.firstChild.firstChild.nodeName === 'IMG',
		replacement: (content, node) => {
			const imgs = [...node.childNodes]
				.map(li => li.firstChild.firstChild.firstChild)
				.map(img => `<img src="${img.getAttribute('src')}" alt="${img.getAttribute('alt')}">`);
			const html = `<Gallery>\n\t${imgs.join("\n\t")}\n</Gallery>`
			return html;
		}
	});

	return turndownService;
}

function getPostContent(post, turndownService, config) {
	let content = post.encoded[0];

	// insert an empty div element between double line breaks
	// this nifty trick causes turndown to keep adjacent paragraphs separated
	// without mucking up content inside of other elemnts (like <code> blocks)
	content = content.replace(/(\r?\n){2}/g, '\n<div></div>\n');

	if (config.saveScrapedImages) {
		// writeImageFile() will save all content images to a relative /images
		// folder so update references in post content to match
		content = content.replace(/(<img[^>]*src=").*?([^/"]+\.(?:gif|jpe?g|png))("[^>]*>)/gi, '$1images/$2$3');
		// SCALED IMAGE REPLACE MARKER (see parser.js)
		content = content.replace(/(\/[a-z0-9_]+)-[a-z0-9]+(\.(?:gif|jpe?g|png))/gi, '$1$2')
	}

	// this is a hack to make <iframe> nodes non-empty by inserting a "." which
	// allows the iframe rule declared in initTurndownService() to take effect
	// (using turndown's blankRule() and keep() solution did not work for me)
	content = content.replace(/(<\/iframe>)/gi, '.$1');

	// use turndown to convert HTML to Markdown
	content = turndownService.turndown(content);

	// clean up extra spaces in list items
	content = content.replace(/(-|\d+\.) +/g, '$1 ');

	// clean up the "." from the iframe hack above
	content = content.replace(/\.(<\/iframe>)/gi, '$1');

	return content;
}

exports.initTurndownService = initTurndownService;
exports.getPostContent = getPostContent;
