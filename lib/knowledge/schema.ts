import { z } from 'zod';

// A knowledge card: one evidence-based answer to one training question,
// written in our own words (never copied text) with the sources it rests on.
// Cards ground the AI coach: it may only cite the sources listed here.

export const KNOWLEDGE_TOPICS = [
  'volume',
  'frequency',
  'intensity',
  'failure',
  'rest',
  'tempo',
  'range-of-motion',
  'exercise-selection',
  'technique',
  'progression',
  'periodization',
  'autoregulation',
  'deload',
  'recovery',
  'warmup',
  'beginners',
  'populations',
  'health',
  'injury',
  'cardio',
  'nutrition',
  'supplements',
  'body-composition',
  'myths',
] as const;

// Crossref-style DOI: "10.<registrant>/<suffix>".
const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/;

export const knowledgeSourceSchema = z
  .object({
    citation: z.string().trim().min(20),
    year: z.number().int().min(1950).max(2100),
    doi: z.string().trim().regex(DOI_PATTERN).optional(),
    url: z.string().trim().url().optional(),
  })
  .strict()
  .refine((s) => s.doi != null || s.url != null, {
    message: 'A source needs a DOI or a URL.',
  });

export const knowledgeCardSchema = z
  .object({
    id: z.string().regex(/^[a-z]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/),
    topic: z.enum(KNOWLEDGE_TOPICS),
    title: z.string().trim().min(3).max(120),
    keywords: z.array(z.string().trim().min(2)).min(3).max(30),
    summary: z.string().trim().min(80).max(2000),
    practice: z.array(z.string().trim().min(3)).min(1).max(8),
    evidence: z.enum(['strong', 'moderate', 'limited']),
    sources: z.array(knowledgeSourceSchema).min(1).max(6),
  })
  .strict();

export type KnowledgeSource = z.infer<typeof knowledgeSourceSchema>;
export type KnowledgeCard = z.infer<typeof knowledgeCardSchema>;
