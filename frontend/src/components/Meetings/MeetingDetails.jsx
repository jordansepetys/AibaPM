import { useState, useEffect, useCallback } from 'react';
import useStore from '../../stores/useStore';
import { meetingsAPI, settingsAPI } from '../../services/api';
import { useMeetingSocket } from '../../hooks/useSocket';
import MeetingSummary from './MeetingSummary';
import MeetingTranscript from './MeetingTranscript';
import MeetingActions from './MeetingActions';
import ProcessingStatus from './ProcessingStatus';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

const MeetingDetails = () => {
  const { selectedMeeting, updateMeeting, setStatus } = useStore();
  const [activeTab, setActiveTab] = useState('summary');
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [settings, setSettings] = useState(null);
  const [useWebSocket, setUseWebSocket] = useState(true);

  // WebSocket status handler
  const handleSocketStatus = useCallback((data) => {
    console.log('WebSocket status update:', data);

    switch (data.status) {
      case 'processing_started':
        setIsProcessing(true);
        setProcessingMessage('Processing started...');
        break;
      case 'transcribing':
        setIsProcessing(true);
        setProcessingMessage(data.message || 'Transcribing audio...');
        break;
      case 'analyzing':
        setIsProcessing(true);
        setProcessingMessage(data.message || 'Generating AI summary...');
        break;
      case 'saving':
        setIsProcessing(true);
        setProcessingMessage(data.message || 'Saving...');
        break;
      case 'completed':
        setIsProcessing(false);
        setProcessingMessage('');
        if (data.meeting) {
          updateMeeting(data.meetingId, data.meeting);
        }
        loadMeetingContent();
        break;
      case 'error':
        setIsProcessing(false);
        setProcessingMessage(`Processing failed: ${data.error}`);
        break;
      case 'CANCELLED':
        setIsProcessing(false);
        setProcessingMessage(data.message || 'Processing cancelled.');
        break;
    }
  }, [updateMeeting]);

  // Use WebSocket for real-time updates
  useMeetingSocket(selectedMeeting?.id, handleSocketStatus);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await settingsAPI.getAll();
        setSettings(loadedSettings);
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    loadSettings();
  }, []);

  // Reset state when meeting changes
  useEffect(() => {
    if (selectedMeeting) {
      setTranscript('');
      setSummary(null);
      setMetadata(null);
      setIsProcessing(false);
      setProcessingMessage('');
      setActiveTab('summary');
      loadMeetingContent();
    } else {
      setTranscript('');
      setSummary(null);
      setMetadata(null);
      setIsProcessing(false);
      setProcessingMessage('');
    }
  }, [selectedMeeting?.id]);

  // Fallback polling for background processing (reduced frequency with WebSocket)
  useEffect(() => {
    if (!selectedMeeting) return;

    let pollInterval = null;
    let pollCount = 0;
    const MAX_POLLS = 300; // Reduced from 1500 since WebSocket handles most updates
    const POLL_INTERVAL = 10000; // 10 seconds instead of 3 (fallback only)

    const checkProcessingStatus = async () => {
      try {
        const response = await meetingsAPI.getById(selectedMeeting.id);
        const meeting = response.meeting || response;

        updateMeeting(meeting.id, meeting);

        if (meeting.transcript_path?.startsWith('ERROR:')) {
          const errorMessage = meeting.transcript_path.substring(7);
          setIsProcessing(false);
          setProcessingMessage(`Processing failed: ${errorMessage}`);
          if (pollInterval) clearInterval(pollInterval);
          return;
        }

        if (meeting.transcript_path === 'CANCELLED') {
          setIsProcessing(false);
          setProcessingMessage('Processing cancelled. Click "Reprocess Meeting" to try again.');
          if (pollInterval) clearInterval(pollInterval);
          return;
        }

        const hasTranscript = !!meeting.transcript_path;
        const hasSummary = !!meeting.summary_path;

        if (hasTranscript && hasSummary) {
          setIsProcessing(false);
          setProcessingMessage('');
          await loadMeetingContent();
          if (pollInterval) clearInterval(pollInterval);
        } else {
          if (!isProcessing) {
            setIsProcessing(true);
            const aiBackend = settings?.['ai.meeting_analysis'] || 'anthropic';
            const modelName = aiBackend === 'anthropic' ? 'Claude Sonnet 4.5' : 'GPT-4o';
            if (!hasTranscript) {
              setProcessingMessage('Transcribing audio with OpenAI Whisper...');
            } else if (!hasSummary) {
              setProcessingMessage(`Generating AI summary with ${modelName}...`);
            }
          }
        }

        pollCount++;
        if (pollCount >= MAX_POLLS) {
          setIsProcessing(false);
          setProcessingMessage('Processing is taking longer than expected. Try refreshing.');
          if (pollInterval) clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Error checking processing status:', error);
      }
    };

    const initialCheck = async () => {
      if (!selectedMeeting.transcript_path || !selectedMeeting.summary_path) {
        setIsProcessing(true);
        const aiBackend = settings?.['ai.meeting_analysis'] || 'anthropic';
        const modelName = aiBackend === 'anthropic' ? 'Claude Sonnet 4.5' : 'GPT-4o';
        setProcessingMessage(`Starting processing (using ${modelName})...`);
        await checkProcessingStatus();
        // Use slower polling as fallback - WebSocket handles real-time updates
        pollInterval = setInterval(checkProcessingStatus, POLL_INTERVAL);
      }
    };

    initialCheck();

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [selectedMeeting?.id, selectedMeeting?.transcript_path, selectedMeeting?.summary_path, settings]);

  const loadMeetingContent = async () => {
    if (!selectedMeeting) return;

    try {
      const response = await meetingsAPI.getById(selectedMeeting.id);
      const fullMeeting = response.meeting || response;

      if (fullMeeting.transcript_path?.startsWith('ERROR:')) {
        const errorMessage = fullMeeting.transcript_path.substring(7);
        setIsProcessing(false);
        setProcessingMessage(`Processing failed: ${errorMessage}`);
        return;
      }

      if (fullMeeting.transcript_path) {
        const transcriptResponse = await fetch(`${API_URL}${fullMeeting.transcript_path}`);
        const transcriptText = await transcriptResponse.text();
        setTranscript(transcriptText);
      }

      if (fullMeeting.summary_path) {
        const summaryResponse = await fetch(`${API_URL}${fullMeeting.summary_path}`);
        const summaryData = await summaryResponse.json();
        setSummary(summaryData);
      }

      setMetadata(response.metadata || fullMeeting.metadata || null);
    } catch (error) {
      console.error('Error loading meeting content:', error);
    }
  };

  const handleReprocess = async () => {
    if (!selectedMeeting) return;

    try {
      setTranscript('');
      setSummary(null);
      setMetadata(null);
      setIsProcessing(true);
      const aiBackend = settings?.['ai.meeting_analysis'] || 'anthropic';
      const modelName = aiBackend === 'anthropic' ? 'Claude Sonnet 4.5' : 'GPT-4o';
      setProcessingMessage(`Reprocessing started - transcribing audio (using ${modelName})...`);
      setStatus('processing', 'Starting reprocessing...');

      const response = await meetingsAPI.reprocess(selectedMeeting.id);
      const clearedMeeting = response.meeting || response;

      updateMeeting(selectedMeeting.id, {
        ...clearedMeeting,
        transcript_path: null,
        summary_path: null
      });

      setStatus('success', 'Reprocessing started! Watch for updates...');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      console.error('Reprocess failed:', error);
      setStatus('error', error.message);
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  const handleCancelProcessing = async () => {
    if (!selectedMeeting) return;

    try {
      const response = await meetingsAPI.cancel(selectedMeeting.id);
      const cancelledMeeting = response.meeting || response;

      updateMeeting(selectedMeeting.id, cancelledMeeting);

      setIsProcessing(false);
      setProcessingMessage('Processing cancelled. Click "Reprocess Meeting" to try again.');
      setStatus('idle');

      // Clear the message after a few seconds
      setTimeout(() => setProcessingMessage(''), 5000);
    } catch (error) {
      console.error('Cancel failed:', error);
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
        <p style={{ fontSize: '64px', margin: '0 0 20px 0' }}>Select a meeting</p>
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

  const tabs = [
    { id: 'summary', label: 'Summary', icon: '' },
    { id: 'transcript', label: 'Transcript', icon: '' },
    { id: 'actions', label: 'Actions', icon: '' },
  ];

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
        <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
          {isProcessing ? (
            <button
              onClick={handleCancelProcessing}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Stop Processing
            </button>
          ) : (
            <button
              onClick={handleReprocess}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Reprocess Meeting
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #dee2e6',
        background: '#f8f9fa'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '12px',
              fontSize: '14px',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              background: activeTab === tab.id ? '#fff' : 'transparent',
              color: activeTab === tab.id ? '#007bff' : '#6c757d',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #007bff' : 'none',
              cursor: 'pointer',
              textTransform: 'capitalize'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Processing Status Banner */}
      <ProcessingStatus isProcessing={isProcessing} message={processingMessage} />

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        textAlign: 'left'
      }}>
        {activeTab === 'summary' && (
          <MeetingSummary
            summary={summary}
            metadata={metadata}
            meeting={selectedMeeting}
          />
        )}

        {activeTab === 'transcript' && (
          <MeetingTranscript transcript={transcript} />
        )}

        {activeTab === 'actions' && (
          <MeetingActions actionItems={summary?.action_items} />
        )}
      </div>
    </div>
  );
};

export default MeetingDetails;
