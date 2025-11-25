const MeetingActions = ({ actionItems }) => {
  if (!actionItems || actionItems.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
        <p>No action items identified</p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'left' }}>
      {actionItems.map((item, idx) => (
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
              Assigned to: {item.owner}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default MeetingActions;
