import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getProjectById } from '../db/database.js';
import { readSummary } from '../services/aiAnalysis.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WIKI_DIR = path.join(__dirname, '../../storage/wikis');

const router = express.Router();

/**
 * GET /api/wiki/:projectId
 * Get wiki content for a project
 */
router.get('/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    // Verify project exists
    const project = getProjectById.get(parseInt(projectId, 10));
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const wikiPath = path.join(WIKI_DIR, `project-${projectId}.md`);

    try {
      const content = await fs.readFile(wikiPath, 'utf-8');
      res.json({
        projectId: parseInt(projectId, 10),
        content,
        lastUpdated: (await fs.stat(wikiPath)).mtime,
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Wiki doesn't exist yet, return empty
        res.json({
          projectId: parseInt(projectId, 10),
          content: `# ${project.name} Wiki\n\nStart documenting your project here...\n`,
          lastUpdated: null,
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/wiki/:projectId
 * Update wiki content for a project
 */
router.put('/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { content } = req.body;

    if (content === undefined) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Verify project exists
    const project = getProjectById.get(parseInt(projectId, 10));
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Ensure wiki directory exists
    await fs.mkdir(WIKI_DIR, { recursive: true });

    const wikiPath = path.join(WIKI_DIR, `project-${projectId}.md`);

    // Save wiki content
    await fs.writeFile(wikiPath, content, 'utf-8');

    const stats = await fs.stat(wikiPath);

    res.json({
      message: 'Wiki updated successfully',
      projectId: parseInt(projectId, 10),
      lastUpdated: stats.mtime,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/wiki/:projectId/auto-update
 * Auto-update wiki with meeting summary
 */
router.post('/:projectId/auto-update', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { meetingId, summaryPath } = req.body;

    if (!meetingId || !summaryPath) {
      return res.status(400).json({ error: 'Meeting ID and summary path are required' });
    }

    // Verify project exists
    const project = getProjectById.get(parseInt(projectId, 10));
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Read meeting summary
    const summary = await readSummary(summaryPath);

    // Get current wiki content
    const wikiPath = path.join(WIKI_DIR, `project-${projectId}.md`);
    let currentContent = '';

    try {
      currentContent = await fs.readFile(wikiPath, 'utf-8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        currentContent = `# ${project.name} Wiki\n\n`;
      } else {
        throw error;
      }
    }

    // Generate meeting section
    const meetingSection = generateMeetingSection(summary, meetingId);

    // Append to wiki
    const updatedContent = currentContent + '\n\n' + meetingSection;

    // Ensure wiki directory exists
    await fs.mkdir(WIKI_DIR, { recursive: true });

    // Save updated wiki
    await fs.writeFile(wikiPath, updatedContent, 'utf-8');

    const stats = await fs.stat(wikiPath);

    res.json({
      message: 'Wiki auto-updated with meeting summary',
      projectId: parseInt(projectId, 10),
      lastUpdated: stats.mtime,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Generate markdown section for a meeting
 */
function generateMeetingSection(summary, meetingId) {
  const date = new Date().toLocaleDateString();

  let markdown = `## Meeting Summary - ${date}\n\n`;
  markdown += `**Meeting ID:** ${meetingId}\n\n`;

  if (summary.overview) {
    markdown += `### Overview\n${summary.overview}\n\n`;
  }

  if (summary.key_decisions && summary.key_decisions.length > 0) {
    markdown += `### Key Decisions\n`;
    summary.key_decisions.forEach(decision => {
      markdown += `- ${decision}\n`;
    });
    markdown += `\n`;
  }

  if (summary.action_items && summary.action_items.length > 0) {
    markdown += `### Action Items\n`;
    summary.action_items.forEach(item => {
      const task = typeof item === 'string' ? item : item.task;
      const owner = typeof item === 'object' && item.owner ? ` (${item.owner})` : '';
      markdown += `- [ ] ${task}${owner}\n`;
    });
    markdown += `\n`;
  }

  if (summary.technical_details && summary.technical_details.length > 0) {
    markdown += `### Technical Details\n`;
    summary.technical_details.forEach(detail => {
      markdown += `- ${detail}\n`;
    });
    markdown += `\n`;
  }

  if (summary.open_questions && summary.open_questions.length > 0) {
    markdown += `### Open Questions\n`;
    summary.open_questions.forEach(question => {
      markdown += `- ${question}\n`;
    });
    markdown += `\n`;
  }

  markdown += `---\n`;

  return markdown;
}

export default router;
