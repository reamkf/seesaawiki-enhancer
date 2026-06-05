export const WikiPageType = {
  TOP: 'TOP',
  PAGE: 'PAGE',
  EDIT: 'EDIT',
  ATTACHMENT: 'ATTACHMENT',
  LIST: 'LIST',
  DIFF: 'DIFF',
  HISTORY: 'HISTORY',
  SEARCH: 'SEARCH',
} as const;

export type WikiPageType = (typeof WikiPageType)[keyof typeof WikiPageType];
