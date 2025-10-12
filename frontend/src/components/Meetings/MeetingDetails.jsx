import { useState, useEffect } from 'react';
import useStore from '../../stores/useStore';
import { meetingsAPI } from '../../services/api';
import MentorFeedback from './MentorFeedback';
import WikiUpdateSuggestions from './WikiUpdateSuggestions';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const MeetingDetails = () => {
  const { selectedMeeting, updateMeeting, setStatus } = useStore();
  const [activeTab, setActiveTab] = useState('summary');
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState(null);
  const [metadata, setMetadata] = useState(null);

  useEffect(() => {
    if (selectedMeeting) {
      // Reset state when switching meetings
      setTranscript('');
      setSummary(null);
      setMetadata(null);
      loadMeetingContent();
    }
  }, [selectedMeeting?.id]); // Only re-run when meeting ID changes

  const loadMeetingContent = async () => {
    if (!selectedMeeting) return;

    try {
      // Fetch full meeting data if needed
      const response = await meetingsAPI.getById(selectedMeeting.id);
      const fullMeeting = response.meeting || response;

      console.log('📥 Loaded meeting:', fullMeeting);

      // Load transcript
      if (fullMeeting.transcript_path) {
        console.log('📄 Loading transcript from:', fullMeeting.transcript_path);
        const transcriptResponse = await fetch(`${API_URL}${fullMeeting.transcript_path}`);
        const transcriptText = await transcriptResponse.text();
        setTranscript(transcriptText);
        console.log('✅ Transcript loaded');
      } else {
        console.log('⚠️ No transcript path');
      }

      // Load summary
      if (fullMeeting.summary_path) {
        console.log('📊 Loading summary from:', fullMeeting.summary_path);
        const summaryResponse = await fetch(`${API_URL}${fullMeeting.summary_path}`);
        const summaryData = await summaryResponse.json();
        setSummary(summaryData);
        console.log('✅ Summary loaded:', summaryData);
      } else {
        console.log('⚠️ No summary path');
      }

      // Set metadata from meeting
      const meetingMetadata = response.metadata || fullMeeting.metadata || null;
      setMetadata(meetingMetadata);
      console.log('📋 Metadata:', meetingMetadata);
    } catch (error) {
      console.error('❌ Error loading meeting content:', error);
    }
  };

  const handleReprocess = async () => {
    if (!selectedMeeting) return;

    try {
      setStatus('processing', 'Reprocessing meeting...');
      await meetingsAPI.reprocess(selectedMeeting.id);

      // Reload meeting data after a delay
      setTimeout(async () => {
        await loadMeetingContent();
        setStatus('success', 'Meeting reprocessed successfully!');
        setTimeout(() => setStatus('idle'), 3000);
      }, 2000);
    } catch (error) {
      setStatus('error', error.message);
    }
  };

  if (!selectedMeeting) {
    return (
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        padding: '60px 20px',
        textAlign: 'center',
        color: '#6c757d'
      }}>
        <p style={{ fontSize: '64px', margin: '0 0 20px 0' }}>📄</p>
        <h3 style={{ margin: '0 0 10px 0' }}>No Meeting Selected</h3>
        <p style={{ margin: 0 }}>Select a meeting from the list to view details</p>
      </div>
    );
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      overflow: 'hidden',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid #dee2e6',
        background: '#f8f9fa'
      }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: 'bold' }}>
          {selectedMeeting.title}
        </h2>
        <div style={{ fontSize: '14px', color: '#6c757d' }}>
          {formatDate(selectedMeeting.date)}
        </div>
        <button
          onClick={handleReprocess}
          style={{
            marginTop: '10px',
            padding: '6px 12px',
            fontSize: '13px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🔄 Reprocess Meeting
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #dee2e6',
        background: '#f8f9fa'
      }}>
        {['summary', 'transcript', 'actions'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '12px',
              fontSize: '14px',
              fontWeight: activeTab === tab ? 'bold' : 'normal',
              background: activeTab === tab ? '#fff' : 'transparent',
              color: activeTab === tab ? '#007bff' : '#6c757d',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #007bff' : 'none',
              cursor: 'pointer',
              textTransform: 'capitalize'
            }}
          >
            {tab === 'summary' && '📊 '}
            {tab === 'transcript' && '📝 '}
            {tab === 'actions' && '✅ '}
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        textAlign: 'left'
      }}>
        {activeTab === 'summary' && (
          <div style={{ textAlign: 'left' }}>
            {summary ? (
              <>
                {/* Overview */}
                {summary.overview && (
                  <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
                      📋 Overview
                    </h3>
                    <p style={{ lineHeight: '1.6', color: '#495057' }}>
                      {summary.overview}
                    </p>
                  </div>
                )}

                {/* Context */}
                {summary.context && (
                  <div style={{ marginBottom: '30px', background: '#f8f9fa', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #007bff' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', color: '#007bff' }}>
                      🔗 Context & Background
                    </h3>
                    <p style={{ lineHeight: '1.6', color: '#495057', margin: 0 }}>
                      {summary.context}
                    </p>
                  </div>
                )}

                {/* Discussion Topics */}
                {summary.discussion_topics && summary.discussion_topics.length > 0 && (
                  <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
                      💬 Discussion Topics
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {summary.discussion_topics.map((topic, idx) => (
                        <span key={idx} style={{
                          padding: '6px 12px',
                          background: '#e7f3ff',
                          color: '#0056b3',
                          borderRadius: '16px',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}>
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Detailed Discussion */}
                {summary.detailed_discussion && summary.detailed_discussion.length > 0 && (
                  <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
                      📝 Detailed Discussion
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      {summary.detailed_discussion.map((point, idx) => {
                        // Handle both string and object formats
                        const isObject = typeof point === 'object' && point !== null;
                        const topic = isObject ? point.topic : null;
                        const details = isObject ? point.details : point;

                        return (
                          <div key={idx} style={{
                            padding: '15px',
                            background: '#f8f9fa',
                            borderRadius: '6px',
                            borderLeft: '3px solid #28a745'
                          }}>
                            <div style={{
                              fontSize: '12px',
                              fontWeight: 'bold',
                              color: '#28a745',
                              marginBottom: '8px'
                            }}>
                              {topic || `Point ${idx + 1}`}
                            </div>
                            <p style={{ lineHeight: '1.8', color: '#495057', margin: 0 }}>
                              {details}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Key Decisions */}
                {summary.key_decisions && summary.key_decisions.length > 0 && (
                  <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
                      🎯 Key Decisions
                    </h3>
                    <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
                      {summary.key_decisions.map((decision, idx) => (
                        <li key={idx} style={{ marginBottom: '8px', color: '#495057' }}>
                          {decision}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Technical Details */}
                {summary.technical_details && summary.technical_details.length > 0 && (
                  <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
                      🔧 Technical Details
                    </h3>
                    <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
                      {summary.technical_details.map((detail, idx) => (
                        <li key={idx} style={{ marginBottom: '8px', color: '#495057' }}>
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Mentor Feedback */}
                <MentorFeedback meeting={selectedMeeting} />

                {/* Wiki Update Suggestions */}
                <WikiUpdateSuggestions meeting={selectedMeeting} />
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                <p>⏳ Summary not yet generated or processing...</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'transcript' && (
          <div style={{ textAlign: 'left' }}>
            {transcript ? (
              <pre style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                lineHeight: '1.8',
                color: '#495057',
                margin: 0
              }}>
                {transcript}
              </pre>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                <p>⏳ Transcript not yet generated or processing...</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'actions' && (
          <div style={{ textAlign: 'left' }}>
            {summary?.action_items && summary.action_items.length > 0 ? (
              <div>
                {summary.action_items.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '15px',
                      marginBottom: '15px',
                      border: '1px solid #dee2e6',
                      borderRadius: '6px',
                      background: '#f8f9fa'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '15px' }}>
                      {item.task || item}
                    </div>
                    {item.owner && (
                      <div style={{ fontSize: '13px', color: '#6c757d' }}>
                        👤 Assigned to: {item.owner}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                <p>✅ No action items identified</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingDetails;
