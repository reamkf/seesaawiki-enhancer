import { context } from './context.js';

export function setupSeesaawikiLinkProvider(monaco) {
  const linkRegex =
    /\[\[(?:.+?>)??([^>]+?)\]\]|(?:&|#)include\(([^)]+)\)|(?:&|#)(?:attachref|ref)\(([^)]+?)\s*(?:,\s*(?:\d+%?|left|right|center|no_link))*\)|(?:&|#)twitter\(([^)]+)\)|(?:&|#)twitter_profile\(([^)]+)\)/g;
  const anchorNameRegex = /^(#[a-zA-Z0-9\-_\.:]+)$/;
  const pageNameWithAnchorRegex = /^(.*?)(#[a-zA-Z0-9\-_\.:]+)$/;

  monaco.languages.registerLinkProvider('seesaawiki', {
    provideLinks: (model) => {
      const links = [];
      const text = model.getValue();
      const matches = text.matchAll(linkRegex);

      for (const match of matches) {
        const linkTarget = match[1] || match[2];
        const imageUrl = match[3];
        const tweetId = match[4];
        const twitterUserName = match[5];

        const range = {
          startLineNumber: model.getPositionAt(match.index).lineNumber,
          startColumn: model.getPositionAt(match.index).column,
          endLineNumber: model.getPositionAt(match.index + match[0].length).lineNumber,
          endColumn: model.getPositionAt(match.index + match[0].length).column,
        };

        if (linkTarget) {
          if (linkTarget.startsWith('http')) {
            links.push({
              range,
              url: linkTarget,
              tooltip: `Open ${linkTarget}`,
              type: 'url',
            });
          } else if (linkTarget.match(anchorNameRegex)) {
            const anchorName = linkTarget.substring(1);
            links.push({
              range,
              tooltip: `Jump to &aname(${anchorName})`,
              type: 'anchor',
              target: anchorName,
            });
          } else {
            links.push({
              range,
              tooltip: `Open ${linkTarget}`,
              type: 'page',
              target: linkTarget,
            });
          }
        } else if (imageUrl) {
          links.push({
            range,
            url: imageUrl,
            tooltip: `Open ${imageUrl}`,
            type: 'image_ref',
          });
        } else if (tweetId) {
          links.push({
            range,
            url: `https://x.com/_/status/${tweetId}`,
            tooltip: `Open Tweet ${tweetId}`,
            type: 'twitter_status',
          });
        } else if (twitterUserName) {
          links.push({
            range,
            url: `https://x.com/${twitterUserName}`,
            tooltip: `Open Twitter Profile @${twitterUserName}`,
            type: 'twitter_profile',
          });
        }
      }

      return { links };
    },
    resolveLink: function (link) {
      const type = link.type;
      if (
        type === 'url' ||
        type === 'image_ref' ||
        type === 'twitter_status' ||
        type === 'twitter_profile'
      ) {
        return { url: link.url };
      } else if (type === 'anchor') {
        const anchorName = link.target;
        const editors = monaco.editor.getEditors();
        const editor = editors.length === 1 ? editors[0] : editors[1];
        const model = editor.getModel();
        const text = model.getValue();
        const anchorMatch = text.match(new RegExp(`(?:&|#)aname\\(${anchorName}\\)`));

        if (anchorMatch) {
          const anchorIndex = anchorMatch.index;
          const anchorPosition = model.getPositionAt(anchorIndex);

          const uri = model.uri.with({
            fragment: `${anchorPosition.lineNumber},${anchorPosition.column}`,
          });

          return {
            range: {
              startLineNumber: anchorPosition.lineNumber,
              startColumn: anchorPosition.column,
              endLineNumber: anchorPosition.lineNumber,
              endColumn: anchorPosition.column + anchorMatch[0].length,
            },
            url: uri,
          };
        }
      } else if (type === 'page') {
        if (!context.getWikiPageUrl) return null;
        const target = link.target;
        const anchorMatch = target.match(pageNameWithAnchorRegex);
        if (anchorMatch) {
          return { url: context.getWikiPageUrl(anchorMatch[1]) + anchorMatch[2] };
        } else {
          return { url: context.getWikiPageUrl(target) };
        }
      }

      return null;
    },
  });
}
