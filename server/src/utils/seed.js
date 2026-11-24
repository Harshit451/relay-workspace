export const seedStarterChannels = async (Conversation) => {
  const starterChannels = [
    { name: 'general', description: 'Announcements, daily check-ins, and team-wide updates.', icon: 'sparkles', accent: '#f2a65a', sortOrder: 1 },
    { name: 'design-lab', description: 'UI/UX ideas, layout feedback, wireframes, and visual polish.', icon: 'palette', accent: '#d87cac', sortOrder: 2 },
    { name: 'build-room', description: 'Feature implementation, API/DB design, bug reports, and deployment logs.', icon: 'terminal', accent: '#6c9aeb', sortOrder: 3 },
  ];
  await Conversation.bulkWrite(starterChannels.map((channel) => ({
    updateOne: {
      filter: { type: 'channel', name: channel.name },
      update: {
        $set: { description: channel.description, icon: channel.icon, accent: channel.accent, sortOrder: channel.sortOrder },
        $setOnInsert: { type: 'channel', memberIds: [], adminIds: [] },
      },
      upsert: true,
    },
  })));
};
