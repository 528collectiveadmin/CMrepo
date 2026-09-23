import { describe, expect, it } from 'vitest';

import { communityBoardPrompts } from './communityBoard';

describe('community board launch prompts', () => {
  it('restores the old site community forum purpose', () => {
    expect(communityBoardPrompts.map((prompt) => prompt.title)).toEqual([
      'Share experiences',
      'Suggest improvements',
      'Volunteer and organize',
    ]);
  });
});