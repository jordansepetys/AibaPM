const ProcessingStatus = ({ isProcessing, message }) => {
  if (!isProcessing && !message) return null;

  const isError = message?.startsWith('Processing failed') || message?.includes('failed');

  return (
    <div style={{
      padding: '15px 20px',
      background: isError
        ? 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)'
        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      fontSize: '14px',
      fontWeight: '500',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      borderBottom: '1px solid #dee2e6'
    }}>
      {!isError && (
        <div style={{
          width: '20px',
          height: '20px',
          border: '3px solid rgba(255,255,255,0.3)',
          borderTop: '3px solid white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      )}
      {message}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ProcessingStatus;
