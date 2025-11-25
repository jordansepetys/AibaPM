const MeetingTranscript = ({ transcript }) => {
  if (!transcript) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
        <p>Transcript not yet generated or processing...</p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'left' }}>
      <pre style={{
        whiteSpace: 'pre-wrap',
        fontFamily: 'inherit',
        lineHeight: '1.8',
        color: '#495057',
        margin: 0
      }}>
        {transcript}
      </pre>
    </div>
  );
};

export default MeetingTranscript;
