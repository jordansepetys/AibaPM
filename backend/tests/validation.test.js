import { describe, it, expect } from 'vitest';
import {
  createProjectSchema,
  createMeetingSchema,
  idParamSchema,
  chatMessageSchema,
  updateWikiSchema,
  searchQuerySchema,
} from '../src/middleware/validation.js';

describe('Validation Schemas', () => {
  describe('createProjectSchema', () => {
    it('should accept valid project name', () => {
      const result = createProjectSchema.safeParse({ name: 'My Project' });
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('My Project');
    });

    it('should trim whitespace from project name', () => {
      const result = createProjectSchema.safeParse({ name: '  Trimmed Name  ' });
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Trimmed Name');
    });

    it('should reject empty project name', () => {
      const result = createProjectSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    it('should reject project name over 200 characters', () => {
      const longName = 'a'.repeat(201);
      const result = createProjectSchema.safeParse({ name: longName });
      expect(result.success).toBe(false);
    });
  });

  describe('idParamSchema', () => {
    it('should accept valid numeric string ID', () => {
      const result = idParamSchema.safeParse({ id: '123' });
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(123);
    });

    it('should reject non-numeric ID', () => {
      const result = idParamSchema.safeParse({ id: 'abc' });
      expect(result.success).toBe(false);
    });

    it('should reject negative ID', () => {
      const result = idParamSchema.safeParse({ id: '-1' });
      expect(result.success).toBe(false);
    });
  });

  describe('createMeetingSchema', () => {
    it('should accept valid meeting data', () => {
      const result = createMeetingSchema.safeParse({
        title: 'Weekly Standup',
        date: '2024-01-15',
        projectId: '1',
      });
      expect(result.success).toBe(true);
      expect(result.data.title).toBe('Weekly Standup');
    });

    it('should accept meeting without projectId', () => {
      const result = createMeetingSchema.safeParse({
        title: 'General Meeting',
        date: '2024-01-15',
      });
      expect(result.success).toBe(true);
    });

    it('should reject meeting without title', () => {
      const result = createMeetingSchema.safeParse({
        date: '2024-01-15',
      });
      expect(result.success).toBe(false);
    });

    it('should reject meeting without date', () => {
      const result = createMeetingSchema.safeParse({
        title: 'Test Meeting',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('chatMessageSchema', () => {
    it('should accept valid chat message', () => {
      const result = chatMessageSchema.safeParse({
        message: 'Hello, world!',
        projectId: 1,
      });
      expect(result.success).toBe(true);
    });

    it('should accept message without projectId', () => {
      const result = chatMessageSchema.safeParse({
        message: 'General question',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty message', () => {
      const result = chatMessageSchema.safeParse({
        message: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject message over 10000 characters', () => {
      const longMessage = 'a'.repeat(10001);
      const result = chatMessageSchema.safeParse({
        message: longMessage,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateWikiSchema', () => {
    it('should accept valid wiki content', () => {
      const result = updateWikiSchema.safeParse({
        content: '# Wiki Content\n\nSome text here.',
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty wiki content', () => {
      const result = updateWikiSchema.safeParse({
        content: '',
      });
      expect(result.success).toBe(true);
    });

    it('should reject wiki content over 500000 characters', () => {
      const longContent = 'a'.repeat(500001);
      const result = updateWikiSchema.safeParse({
        content: longContent,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('searchQuerySchema', () => {
    it('should accept valid search query', () => {
      const result = searchQuerySchema.safeParse({
        q: 'search term',
      });
      expect(result.success).toBe(true);
    });

    it('should accept search with projectId', () => {
      const result = searchQuerySchema.safeParse({
        q: 'search term',
        projectId: '1',
      });
      expect(result.success).toBe(true);
      expect(result.data.projectId).toBe(1);
    });

    it('should reject empty search query', () => {
      const result = searchQuerySchema.safeParse({
        q: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject search query over 500 characters', () => {
      const longQuery = 'a'.repeat(501);
      const result = searchQuerySchema.safeParse({
        q: longQuery,
      });
      expect(result.success).toBe(false);
    });
  });
});
