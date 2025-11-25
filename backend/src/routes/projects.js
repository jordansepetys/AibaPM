import express from 'express';
import {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
} from '../db/database.js';
import {
  validate,
  idParamSchema,
  createProjectSchema,
  updateProjectSchema,
} from '../middleware/validation.js';

const router = express.Router();

/**
 * GET /api/projects
 * Get all projects
 */
router.get('/', (req, res, next) => {
  try {
    const projects = getAllProjects.all();
    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/', validate(createProjectSchema), (req, res, next) => {
  try {
    const { name } = req.body;

    const result = createProject.run(name);
    const project = getProjectById.get(result.lastInsertRowid);

    res.status(201).json({
      message: 'Project created successfully',
      project,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/:id
 * Get a specific project by ID
 */
router.get('/:id', validate(idParamSchema, 'params'), (req, res, next) => {
  try {
    const { id } = req.params;

    const project = getProjectById.get(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/projects/:id
 * Update a project
 */
router.put('/:id', validate(idParamSchema, 'params'), validate(updateProjectSchema), (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const project = getProjectById.get(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    updateProject.run(name, id);
    const updatedProject = getProjectById.get(id);

    res.json({
      message: 'Project updated successfully',
      project: updatedProject,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/projects/:id
 * Delete a project
 */
router.delete('/:id', validate(idParamSchema, 'params'), (req, res, next) => {
  try {
    const { id } = req.params;

    const project = getProjectById.get(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    deleteProject.run(id);

    res.json({
      message: 'Project deleted successfully',
      project,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
