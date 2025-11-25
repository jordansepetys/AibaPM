import { useState, useEffect } from 'react';
import useStore from '../../stores/useStore';
import { skillsAPI } from '../../services/api';
import SkillEditor from './SkillEditor';
import SkillCard from './SkillCard';
import './Skills.css';

const SkillsManager = () => {
  const { projects, setStatus } = useStore();
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);

  useEffect(() => {
    loadSkills();
  }, [filter]);

  const loadSkills = async () => {
    try {
      setLoading(true);
      let filters = {};

      if (filter === 'global') {
        filters.global = true;
      } else if (filter !== 'all' && !isNaN(filter)) {
        filters.projectId = filter;
      }

      const data = await skillsAPI.getAll(filters);
      setSkills(data);
    } catch (error) {
      setStatus('error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSkill = () => {
    setEditingSkill(null);
    setShowEditor(true);
  };

  const handleEditSkill = (skill) => {
    setEditingSkill(skill);
    setShowEditor(true);
  };

  const handleDeleteSkill = async (skillId, skillName) => {
    if (!confirm(`Are you sure you want to delete "${skillName}"?`)) {
      return;
    }

    try {
      await skillsAPI.delete(skillId);
      setStatus('success', 'Skill deleted successfully');
      setTimeout(() => setStatus('idle'), 3000);
      loadSkills();
    } catch (error) {
      setStatus('error', error.message);
    }
  };

  const handleSaveSkill = async () => {
    setShowEditor(false);
    setEditingSkill(null);
    loadSkills();
  };

  const handleCancelEdit = () => {
    setShowEditor(false);
    setEditingSkill(null);
  };

  // Filter skills by search query
  const filteredSkills = skills.filter(skill =>
    skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    skill.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group skills by scope
  const globalSkills = filteredSkills.filter(s => s.isGlobal);
  const projectSkillsGrouped = {};
  filteredSkills.filter(s => !s.isGlobal).forEach(skill => {
    const projectId = skill.project_id;
    if (!projectSkillsGrouped[projectId]) {
      projectSkillsGrouped[projectId] = [];
    }
    projectSkillsGrouped[projectId].push(skill);
  });

  return (
    <>
      <div className="skills-manager">
        {/* Header */}
        <div className="skills-manager__header">
          <h2 className="skills-manager__title">Skills Manager</h2>
          <button onClick={handleCreateSkill} className="skills-manager__new-btn">
            + New Skill
          </button>
        </div>

        {/* Filters */}
        <div className="skills-manager__filters">
          <button
            onClick={() => setFilter('all')}
            className={`skills-manager__filter-btn ${filter === 'all' ? 'skills-manager__filter-btn--active' : ''}`}
          >
            All Skills
          </button>
          <button
            onClick={() => setFilter('global')}
            className={`skills-manager__filter-btn ${filter === 'global' ? 'skills-manager__filter-btn--active' : ''}`}
          >
            Global Only
          </button>
          {projects.map(project => (
            <button
              key={project.id}
              onClick={() => setFilter(project.id)}
              className={`skills-manager__filter-btn ${filter === project.id ? 'skills-manager__filter-btn--active' : ''}`}
            >
              {project.name}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search skills..."
          className="skills-manager__search"
        />

        {/* Skills List */}
        {loading ? (
          <div className="skills-manager__loading">Loading skills...</div>
        ) : filteredSkills.length === 0 ? (
          <div className="skills-manager__empty">
            No skills found. Create your first skill to get started!
          </div>
        ) : (
          <div>
            {/* Global Skills */}
            {globalSkills.length > 0 && (
              <div className="skills-manager__group">
                <h3 className="skills-manager__group-title">
                  Global Skills ({globalSkills.length})
                </h3>
                <div className="skills-manager__group-list">
                  {globalSkills.map(skill => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      onEdit={handleEditSkill}
                      onDelete={handleDeleteSkill}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Project Skills */}
            {Object.entries(projectSkillsGrouped).map(([projectId, projectSkills]) => {
              const project = projects.find(p => p.id === parseInt(projectId));
              return (
                <div key={projectId} className="skills-manager__group">
                  <h3 className="skills-manager__group-title">
                    {project?.name || `Project ${projectId}`} Skills ({projectSkills.length})
                  </h3>
                  <div className="skills-manager__group-list">
                    {projectSkills.map(skill => (
                      <SkillCard
                        key={skill.id}
                        skill={skill}
                        onEdit={handleEditSkill}
                        onDelete={handleDeleteSkill}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <SkillEditor
          skill={editingSkill}
          onSave={handleSaveSkill}
          onCancel={handleCancelEdit}
        />
      )}
    </>
  );
};

export default SkillsManager;
