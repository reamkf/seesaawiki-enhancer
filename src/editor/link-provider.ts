import type * as monacoNs from 'monaco-editor';
import { context } from './context.js';

type MonacoNamespace = typeof monacoNs;

type SeesaawikiLinkType =
  | 'url'
  | 'anchor'
  | 'page'
  | 'image_ref'
  | 'twitter_status'
  | 'twitter_profile';

interface SeesaawikiLink extends monacoNs.languages.ILink {
  type: SeesaawikiLinkType;
  target?: string;
}

export function setupSeesaawikiLinkProvider(monaco: MonacoNamespace): void {
  const linkRegex =
    /\[\[(?:.+?>)??([^>]+?)\]\]|(?:&|#)include\(([^)]+)\)|(?:&|#)(?:attachref|ref)\(([^)]+?)\s*(?:,\s*(?:\d+%?|left|right|center|no_link))*\)|(?:&|#)twitter\(([^)]+)\)|(?:&|#)twitter_profile\(([^)]+)\)/g;
  const anchorNameRegex = /^(#[a-zA-Z0-9\-_\.:]+)$/;
  const pageNameWithAnchorRegex = /^(.*?)(#[a-zA-Z0-9\-_\.:]+)$/;

  monaco.languages.registerLinkProvider('seesaawiki', {
    provideLinks: (model) => {
      const links: SeesaawikiLink[] = [];
      const text = model.getValue();
      const matches = text.matchAll(linkRegex);

      for (const match of matches) {
        const linkTarget = match[1] || match[2];
        const imageUrl = match[3];
        const tweetId = match[4];
        const twitterUserName = match[5];
        const matchIndex = match.index ?? 0;

        const range = {
          startLineNumber: model.getPositionAt(matchIndex).lineNumber,
          startColumn: model.getPositionAt(matchIndex).column,
          endLineNumber: model.getPositionAt(matchIndex + match[0].length).lineNumber,
          endColumn: model.getPositionAt(matchIndex + match[0].length).column,
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
    resolveLink(link) {
      const seesaawikiLink = link as SeesaawikiLink;
      const type = seesaawikiLink.type;
      if (
        type === 'url' ||
        type === 'image_ref' ||
        type === 'twitter_status' ||
        type === 'twitter_profile'
      ) {
        return { range: link.range, url: link.url };
      } else if (type === 'anchor') {
        const anchorName = seesaawikiLink.target;
        const editors = monaco.editor.getEditors();
        const editor = editors.length === 1 ? editors[0] : editors[1];
        const model = editor.getModel();
        if (!model) return null;
        const text = model.getValue();
        const anchorMatch = text.match(new RegExp(`(?:&|#)aname\\(${anchorName}\\)`));

        if (anchorMatch && anchorMatch.index !== undefined) {
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
        const target = seesaawikiLink.target ?? '';
        const anchorMatch = target.match(pageNameWithAnchorRegex);
        if (anchorMatch) {
          return { range: link.range, url: context.getWikiPageUrl(anchorMatch[1]) + anchorMatch[2] };
        } else {
          return { range: link.range, url: context.getWikiPageUrl(target) };
        }
      }

      return null;
    },
  });
}
