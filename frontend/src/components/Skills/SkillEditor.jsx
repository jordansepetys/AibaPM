import { useState, useEffect } from 'react';
import useStore from '../../stores/useStore';
import { skillsAPI } from '../../services/api';
import './Skills.css';

const SkillEditor = ({ skill, onSave, onCancel }) => {
  const { projects, setStatus } = useStore();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    isGlobal: true,
    projectId: null,
    triggerKeywords: [],
    autoActivate: true,
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (skill) {
      setFormData({
        name: skill.name || '',
        description: skill.description || '',
        content: skill.content || '',
        isGlobal: skill.isGlobal,
        projectId: skill.project_id,
        triggerKeywords: skill.triggerKeywords || [],
        autoActivate: skill.autoActivate !== false,
      });
    }
  }, [skill]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddKeyword = (e) => {
    e.preventDefault();
    const keyword = keywordInput.trim();
    if (keyword && !formData.triggerKeywords.includes(keyword)) {
      setFormData(prev => ({
        ...prev,
        triggerKeywords: [...prev.triggerKeywords, keyword]
      }));
      setKeywordInput('');
    }
  };

  const handleKeywordKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleAddKeyword(e);
    }
  };

  const handleRemoveKeyword = (keyword) => {
    setFormData(prev => ({
      ...prev,
      triggerKeywords: prev.triggerKeywords.filter(k => k !== keyword)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      setStatus('error', 'Skill name is required');
      return;
    }

    if (!formData.content.trim()) {
      setStatus('error', 'Skill content is required');
      return;
    }

    if (!formData.isGlobal && !formData.projectId) {
      setStatus('error', 'Please select a project for project-specific skills');
      return;
    }

    if (formData.triggerKeywords.length === 0) {
      setStatus('error', 'Please add at least one trigger keyword');
      return;
    }

    try {
      setSaving(true);

      const skillData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        content: formData.content.trim(),
        isGlobal: formData.isGlobal,
        projectId: formData.isGlobal ? null : parseInt(formData.projectId),
        triggerKeywords: formData.triggerKeywords,
        autoActivate: formData.autoActivate,
      };

      if (skill) {
        await skillsAPI.update(skill.id, skillData);
        setStatus('success', 'Skill updated successfully!');
      } else {
        await skillsAPI.create(skillData);
        setStatus('success', 'Skill created successfully!');
      }

      setTimeout(() => setStatus('idle'), 3000);
      onSave();
    } catch (error) {
      setStatus('error', error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="skill-editor-overlay" onClick={onCancel}>
      <div className="skill-editor" onClick={(e) => e.stopPropagation()}>
        <div className="skill-editor__header">
          <h2 className="skill-editor__title">
            {skill ? 'Edit Skill' : 'Create New Skill'}
          </h2>
          <button onClick={onCancel} className="skill-editor__close-btn">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="skill-editor__form">
          {/* Name */}
          <div className="skill-editor__field">
            <label className="skill-editor__label">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Status Update Format"
              className="skill-editor__input"
              required
            />
          </div>

          {/* Description */}
          <div className="skill-editor__field">
            <label className="skill-editor__label">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief description of this skill..."
              className="skill-editor__input"
            />
          </div>

          {/* Scope */}
          <div className="skill-editor__field">
            <label className="skill-editor__label">Scope *</label>
            <div className="skill-editor__scope-options">
              <label className="skill-editor__scope-option">
                <input
                  type="radio"
                  checked={formData.isGlobal}
                  onChange={() => {
                    handleChange('isGlobal', true);
                    handleChange('projectId', null);
                  }}
                />
                Global (all projects)
              </label>
              <label className="skill-editor__scope-option">
                <input
                  type="radio"
                  checked={!formData.isGlobal}
                  onChange={() => handleChange('isGlobal', false)}
                />
                Project-specific
              </label>
            </div>
            {!formData.isGlobal && (
              <select
                value={formData.projectId || ''}
                onChange={(e) => handleChange('projectId', e.target.value)}
                className="skill-editor__select"
                required
              >
                <option value="">Select a project...</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Content (Markdown) */}
          <div className="skill-editor__field">
            <label className="skill-editor__label">Content (Markdown) *</label>
            <textarea
              value={formData.content}
              onChange={(e) => handleChange('content', e.target.value)}
              placeholder="# Skill Instructions&#10;&#10;When the user asks about [topic], respond with...&#10;&#10;## Format&#10;- Use bullet points&#10;- Be concise"
              className="skill-editor__textarea"
              required
            />
            <div className="skill-editor__hint">
              Use Markdown formatting. This content will be injected into the AI's system prompt when activated.
            </div>
          </div>

          {/* Trigger Keywords */}
          <div className="skill-editor__field">
            <label className="skill-editor__label">Trigger Keywords *</label>
            <div className="skill-editor__keyword-input">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeywordKeyDown}
                placeholder="Enter a keyword or phrase..."
                className="skill-editor__input"
              />
              <button
                type="button"
                onClick={handleAddKeyword}
                className="skill-editor__add-btn"
              >
                + Add
              </button>
            </div>
            <div className="skill-editor__keywords">
              {formData.triggerKeywords.map((keyword, idx) => (
                <span key={idx} className="skill-editor__keyword-tag">
                  {keyword}
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(keyword)}
                    className="skill-editor__keyword-remove"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
            <div className="skill-editor__hint">
              Add keywords or phrases that will trigger this skill in chat conversations.
            </div>
          </div>

          {/* Auto-activate */}
          <div className="skill-editor__checkbox">
            <label className="skill-editor__checkbox-label">
              <input
                type="checkbox"
                checked={formData.autoActivate}
                onChange={(e) => handleChange('autoActivate', e.target.checked)}
              />
              Auto-activate when keywords match
            </label>
            <div className="skill-editor__checkbox-hint">
              If unchecked, this skill will only activate when manually selected.
            </div>
          </div>

          {/* Buttons */}
          <div className="skill-editor__actions">
            <button
              type="button"
              onClick={onCancel}
              className="skill-editor__cancel-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="skill-editor__submit-btn"
            >
              {saving ? 'Saving...' : (skill ? 'Update Skill' : 'Create Skill')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SkillEditor;
