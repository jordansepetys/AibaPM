import { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import useStore from '../../stores/useStore';
import { wikiAPI } from '../../services/api';

const WikiEditor = () => {
  const { projects, selectedProject, selectProject, setStatus } = useStore();
  const [content, setContent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const saveTimeoutRef = useRef(null);
  const textareaRef = useRef(null);

  // Configure marked options
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  // Load wiki content when project changes
  useEffect(() => {
    if (selectedProject) {
      loadWiki(selectedProject.id);
    }
  }, [selectedProject]);

  const loadWiki = async (projectId) => {
    try {
      setStatus('processing', 'Loading wiki...');
      const wiki = await wikiAPI.get(projectId);
      setContent(wiki.content || '');
      setStatus('idle');
    } catch (error) {
      console.error('Error loading wiki:', error);
      setStatus('error', error.message);
    }
  };

  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save (2 seconds after last change)
    saveTimeoutRef.current = setTimeout(() => {
      saveWiki(newContent);
    }, 2000);
  };

  const saveWiki = async (contentToSave) => {
    if (!selectedProject) return;

    try {
      setIsSaving(true);
      await wikiAPI.update(selectedProject.id, contentToSave);
      setLastSaved(new Date());
      setIsSaving(false);
      console.log('✅ Wiki saved');
    } catch (error) {
      console.error('Error saving wiki:', error);
      setIsSaving(false);
      setStatus('error', 'Failed to save wiki: ' + error.message);
    }
  };

  const handleManualSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveWiki(content);
  };

  const highlightSearchTerm = (text) => {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  };

  const getPreviewHtml = () => {
    const html = marked(content);
    return searchTerm ? highlightSearchTerm(html) : html;
  };

  const formatLastSaved = () => {
    if (!lastSaved) return '';
    const now = new Date();
    const diff = Math.floor((now - lastSaved) / 1000);

    if (diff < 60) return 'Saved just now';
    if (diff < 3600) return `Saved ${Math.floor(diff / 60)}m ago`;
    return lastSaved.toLocaleTimeString();
  };

  if (!selectedProject) {
    return (
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        padding: '60px 20px',
        textAlign: 'center',
        color: '#6c757d'
      }}>
        <p style={{ fontSize: '64px', margin: '0 0 20px 0' }}>📚</p>
        <h3 style={{ margin: '0 0 20px 0' }}>No Project Selected</h3>
        <p style={{ margin: '0 0 20px 0' }}>Select a project to view or edit its wiki</p>

        {projects.length > 0 && (
          <select
            onChange={(e) => {
              const project = projects.find(p => p.id === parseInt(e.target.value));
              if (project) selectProject(project);
            }}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              background: '#fff',
              minWidth: '250px'
            }}
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
    );
  }

  return (
    <div style={{
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      overflow: 'hidden',
      height: 'calc(100vh - 250px)',
      minHeight: '600px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '15px 20px',
        borderBottom: '1px solid #dee2e6',
        background: '#f8f9fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0', fontSize: '20px', fontWeight: 'bold' }}>
            📚 {selectedProject.name} - Wiki
          </h2>
          <div style={{ fontSize: '13px', color: '#6c757d' }}>
            {isSaving && '💾 Saving...'}
            {!isSaving && lastSaved && `✓ ${formatLastSaved()}`}
            {!isSaving && !lastSaved && 'Auto-saves 2 seconds after last change'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Search */}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search in wiki..."
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              width: '200px'
            }}
          />

          {/* Save Button */}
          <button
            onClick={handleManualSave}
            disabled={isSaving}
            style={{
              padding: '6px 16px',
              fontSize: '13px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.6 : 1
            }}
          >
            💾 Save Now
          </button>
        </div>
      </div>

      {/* Split Screen Editor */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        overflow: 'hidden'
      }}>
        {/* Editor Panel */}
        <div style={{
          borderRight: '1px solid #dee2e6',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '10px 15px',
            background: '#f8f9fa',
            borderBottom: '1px solid #dee2e6',
            fontWeight: 'bold',
            fontSize: '14px'
          }}>
            ✏️ Editor
          </div>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            placeholder="Write your project wiki in Markdown..."
            style={{
              flex: 1,
              padding: '20px',
              border: 'none',
              fontSize: '14px',
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
              lineHeight: '1.6',
              resize: 'none',
              outline: 'none'
            }}
          />
        </div>

        {/* Preview Panel */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          background: '#fafbfc'
        }}>
          <div style={{
            padding: '10px 15px',
            background: '#f8f9fa',
            borderBottom: '1px solid #dee2e6',
            fontWeight: 'bold',
            fontSize: '14px'
          }}>
            👁️ Preview
          </div>
          <div
            style={{
              flex: 1,
              padding: '20px',
              overflowY: 'auto',
              fontSize: '14px',
              lineHeight: '1.8'
            }}
            dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
          />
        </div>
      </div>

      {/* Helper Text */}
      <div style={{
        padding: '10px 20px',
        background: '#f8f9fa',
        borderTop: '1px solid #dee2e6',
        fontSize: '12px',
        color: '#6c757d',
        display: 'flex',
        gap: '20px',
        flexWrap: 'wrap'
      }}>
        <span><strong>**bold**</strong></span>
        <span><em>*italic*</em></span>
        <span>[link](url)</span>
        <span># Heading</span>
        <span>- List item</span>
        <span>`code`</span>
      </div>

      <style>{`
        mark {
          background-color: #ffeb3b;
          padding: 2px 4px;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
};

export default WikiEditor;
