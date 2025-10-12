import { useEffect, useState } from 'react';
import useStore from './stores/useStore';
import { projectsAPI, meetingsAPI, healthCheck } from './services/api';
import AudioRecorder from './components/Recording/AudioRecorder';
import RecordingStatus from './components/Recording/RecordingStatus';
import MeetingsList from './components/Meetings/MeetingsList';
import MeetingDetails from './components/Meetings/MeetingDetails';
import WikiEditor from './components/Wiki/WikiEditor';
import GlobalSearch from './components/Search/GlobalSearch';
import ProjectManager from './components/Projects/ProjectManager';
import ChatSidebar from './components/Chat/ChatSidebar';
import ChatButton from './components/Chat/ChatButton';
import './App.css';

function App() {
  const {
    projects = [],
    meetings = [],
    setProjects,
    setMeetings,
    setStatus,
    activeTab,
    setActiveTab,
  } = useStore();

  const [appTab, setAppTab] = useState('recording');

  useEffect(() => {
    // Load projects and meetings on mount
    const loadData = async () => {
      try {
        // Health check
        await healthCheck();
        console.log('✅ Backend connection successful');

        // Load projects
        const projectsData = await projectsAPI.getAll();
        setProjects(projectsData);
        console.log('✅ Projects loaded:', projectsData);

        // Load meetings
        const meetingsData = await meetingsAPI.getAll();
        setMeetings(meetingsData);
        console.log('✅ Meetings loaded:', meetingsData);
      } catch (error) {
        console.error('❌ Error loading data:', error.message);
        setStatus('error', error.message);
      }
    };

    loadData();
  }, [setProjects, setMeetings, setStatus]);

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>
      {/* Header */}
      <header style={{
        background: '#fff',
        borderBottom: '1px solid #dee2e6',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '30px', marginBottom: '15px' }}>
            <div style={{ flex: '0 0 auto' }}>
              <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold' }}>
                🎙️ Aiba PM
              </h1>
            </div>
            <GlobalSearch
              onMeetingSelect={(meeting) => {
                setAppTab('meetings');
              }}
            />
          </div>
          <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
            AI-Powered Meeting Transcription & Project Management
          </p>
        </div>
      </header>

      {/* Main Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
        <RecordingStatus />

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px'
        }}>
          <button
            onClick={() => setAppTab('recording')}
            style={{
              padding: '12px 24px',
              fontSize: '15px',
              fontWeight: appTab === 'recording' ? 'bold' : 'normal',
              background: appTab === 'recording' ? '#007bff' : '#fff',
              color: appTab === 'recording' ? '#fff' : '#495057',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            🎤 Record
          </button>
          <button
            onClick={() => setAppTab('meetings')}
            style={{
              padding: '12px 24px',
              fontSize: '15px',
              fontWeight: appTab === 'meetings' ? 'bold' : 'normal',
              background: appTab === 'meetings' ? '#007bff' : '#fff',
              color: appTab === 'meetings' ? '#fff' : '#495057',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            📋 Meetings ({meetings.length})
          </button>
          <button
            onClick={() => setAppTab('wiki')}
            style={{
              padding: '12px 24px',
              fontSize: '15px',
              fontWeight: appTab === 'wiki' ? 'bold' : 'normal',
              background: appTab === 'wiki' ? '#007bff' : '#fff',
              color: appTab === 'wiki' ? '#fff' : '#495057',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            📚 Wiki
          </button>
          <button
            onClick={() => setAppTab('projects')}
            style={{
              padding: '12px 24px',
              fontSize: '15px',
              fontWeight: appTab === 'projects' ? 'bold' : 'normal',
              background: appTab === 'projects' ? '#007bff' : '#fff',
              color: appTab === 'projects' ? '#fff' : '#495057',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            📁 Projects ({projects.length})
          </button>
        </div>

        {/* Recording Tab */}
        {appTab === 'recording' && (
          <>
            <div style={{
              background: '#fff',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              marginBottom: '20px'
            }}>
              <AudioRecorder />
            </div>

            {/* Stats Section */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '20px',
              marginTop: '30px'
            }}>
              <div style={{
                background: '#fff',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#6c757d' }}>
                  Total Projects
                </h3>
                <p style={{ margin: 0, fontSize: '36px', fontWeight: 'bold', color: '#007bff' }}>
                  {projects.length}
                </p>
              </div>

              <div style={{
                background: '#fff',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#6c757d' }}>
                  Total Meetings
                </h3>
                <p style={{ margin: 0, fontSize: '36px', fontWeight: 'bold', color: '#28a745' }}>
                  {meetings.length}
                </p>
              </div>

              <div style={{
                background: '#fff',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#6c757d' }}>
                  Recent Meeting
                </h3>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: '500', color: '#495057' }}>
                  {meetings.length > 0
                    ? meetings[0].title
                    : 'No meetings yet'}
                </p>
              </div>
            </div>

            {/* Quick Start Guide */}
            {projects.length === 0 && (
              <div style={{
                background: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '8px',
                padding: '20px',
                marginTop: '30px'
              }}>
                <h3 style={{ margin: '0 0 15px 0' }}>👋 Getting Started</h3>
                <ol style={{ margin: 0, paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '10px' }}>
                    First, create a project using the backend API:
                    <pre style={{ background: '#f8f9fa', padding: '10px', borderRadius: '4px', marginTop: '5px' }}>
                      {`curl -X POST http://localhost:3001/api/projects \\
  -H "Content-Type: application/json" \\
  -d '{"name": "My First Project"}'`}
                    </pre>
                  </li>
                  <li style={{ marginBottom: '10px' }}>
                    Reload this page to see your project
                  </li>
                  <li style={{ marginBottom: '10px' }}>
                    Select your project from the dropdown above
                  </li>
                  <li>
                    Click "Start Recording" to record your first meeting!
                  </li>
                </ol>
              </div>
            )}
          </>
        )}

        {/* Meetings Tab */}
        {appTab === 'meetings' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '400px 1fr',
            gap: '20px',
            height: 'calc(100vh - 250px)',
            minHeight: '600px'
          }}>
            {/* Meetings List Sidebar */}
            <MeetingsList />

            {/* Meeting Details */}
            <MeetingDetails />
          </div>
        )}

        {/* Wiki Tab */}
        {appTab === 'wiki' && (
          <WikiEditor />
        )}

        {/* Projects Tab */}
        {appTab === 'projects' && (
          <ProjectManager />
        )}
      </div>

      {/* Chat Sidebar - Always rendered */}
      <ChatSidebar />

      {/* Floating Chat Button */}
      <ChatButton />
    </div>
  );
}

export default App;
