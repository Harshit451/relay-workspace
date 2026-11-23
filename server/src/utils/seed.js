export const seedStarterChannels = async (Conversation) => {
  if (await Conversation.countDocuments({ type: 'channel' })) return;
  await Conversation.insertMany([
    { name: 'general', description: 'A shared space for company-wide updates', icon: 'sparkles', accent: '#f2a65a', sortOrder: 1, type: 'channel' },
    { name: 'design-lab', description: 'Share explorations, references, and feedback', icon: 'palette', accent: '#d87cac', sortOrder: 2, type: 'channel' },
    { name: 'build-room', description: 'Ship notes, decisions, and daily momentum', icon: 'terminal', accent: '#6c9aeb', sortOrder: 3, type: 'channel' },
  ]);
};
