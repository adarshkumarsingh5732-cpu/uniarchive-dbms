export type ResourceType = 'Notes' | 'Question Bank' | 'Cheatsheet' | 'Lab Report' | 'Solution';

export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
  upvotes: number;
  isOp?: boolean;
}

export interface Resource {
  id: string;
  title: string;
  courseCode: string;
  slot: string;
  type: ResourceType;
  topics: string[];
  qualityScore: number;
  completeness: number; // 0-100
  upvotes: number;
  downloads: number;
  views: number; // Added views
  commentsCount?: number;
  author: string;
  professor?: string;
  semester?: string;
  year?: string;
  createdAt: string;
  description?: string; 
  pdfUrl?: string; // URL for the PDF viewer
  comments?: Comment[];
}

export interface CourseStats {
  courseCode: string;
  completeness: number; // 0-100
  qualityAvg: number;
  totalResources: number;
  topicCoverage: { topic: string; coverage: number }[];
  activityGrid?: number[]; // Array of 365 days of activity intensity (0-4)
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface PinnedSubject {
  code: string;
  name: string;
  /** Derived from live data at render time; not persisted in the constant. */
  resourcesCount?: number;
}

/** One archived resource the AI answer was grounded in. */
export interface AIAnswerSource {
  id: string;
  title: string;
  courseCode: string;
  type: string;
}

/** Response of POST /api/ai/ask. */
export interface AIAnswer {
  answer: string;
  sources: AIAnswerSource[];
  ai: { model: string; provider: string } | null;
}

export interface User {
  email: string;
  username: string;
  isVerified: boolean;
  role: 'student' | 'admin';
}

export interface FooterConfig {
  maintainer: string;
  email: string;
  githubUrl: string;
  twitterUrl?: string;
  discordUrl?: string;
  version: string;
}

export enum ViewMode {
  DISCOVER = 'DISCOVER',
  ANALYTICS = 'ANALYTICS',
  SUBJECT_DETAIL = 'SUBJECT_DETAIL',
  RESOURCE_VIEWER = 'RESOURCE_VIEWER',
  LIBRARY = 'LIBRARY', // Added Library mode
}
