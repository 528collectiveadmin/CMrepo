export type CommunityBoardPrompt = {
  title: string;
  description: string;
};

export const communityBoardPrompts: CommunityBoardPrompt[] = [
  {
    title: 'Share experiences',
    description: 'Tell the community what the 5:28 practice felt like in your time zone.',
  },
  {
    title: 'Suggest improvements',
    description: 'Offer ideas for making the platform clearer, kinder, and easier to share.',
  },
  {
    title: 'Volunteer and organize',
    description: 'Raise your hand for outreach, music, moderation, translation, or launch support.',
  },
];
