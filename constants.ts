import { FAQItem, PinnedSubject, FooterConfig } from './types';

// Note: resource and course-stat data now comes from the API (see services/api.ts).
// The old MOCK_RESOURCES / MOCK_COURSE_STATS fixtures were removed so they are no
// longer shipped in the production bundle.

export const FOOTER_CONFIG: FooterConfig = {
  maintainer: "UniArchives Core Team",
  email: "support@uniarchives.edu",
  githubUrl: "https://github.com/uniarchives/core",
  twitterUrl: "https://twitter.com/uniarchives",
  discordUrl: "https://discord.gg/uniarchives",
  version: "Beta v0.9.2"
};

// Mirrors the topics the seeded archive actually has (see db/seed.sql), so the
// search-overlay suggestions always return something.
export const AVAILABLE_TOPICS = [
  'SQL', 'Indexing', 'PL/SQL', 'Joins', 'Normalization',
  'Probability', 'Normal Distribution', 'Hypothesis Testing',
  'ANOVA', 'Regression', 'Combinatorics',
  'Networks', 'Topology', 'Quantitative Skills'
];

export const FAQ_DATA: FAQItem[] = [
  {
    question: "What is UniArchives?",
    answer: "UniArchives is a decentralized, slot-based resource sharing platform designed to break down information silos between different class sections."
  },
  {
    question: "How do I gain reputation?",
    answer: "You earn reputation points when other students upvote or download your uploaded resources. Consistent quality contributions unlock badges."
  },
  {
    question: "Is this platform official?",
    answer: "No, UniArchives is a student-run initiative and is not officially affiliated with the university administration."
  },
  {
    question: "How do I create an account?",
    answer: "Use Create account in the sign-in dialog — pick a username, email and password and you can upload straight away. No email verification step."
  }
];

// Counts are derived from live data at render time (see Dashboard).
export const INITIAL_PINNED_SUBJECTS: PinnedSubject[] = [
  { code: 'BACSE202', name: 'Database Systems' },
  { code: 'BAMAT207', name: 'Probability & Statistics' }
];
