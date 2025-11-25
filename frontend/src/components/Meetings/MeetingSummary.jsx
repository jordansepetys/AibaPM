import MentorFeedback from './MentorFeedback';
import WikiUpdateSuggestions from './WikiUpdateSuggestions';

const MeetingSummary = ({ summary, metadata, meeting }) => {
  if (!summary) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
        <p>Waiting for summary...</p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'left' }}>
      {/* AI Model Info Badge */}
      {metadata?.ai_model_info && <AIModelBadge metadata={metadata} />}

      {/* Overview */}
      {summary.overview && (
        <Section title="Overview" icon="">
          <p style={{ lineHeight: '1.6', color: '#495057' }}>
            {summary.overview}
          </p>
        </Section>
      )}

      {/* Context */}
      {summary.context && (
        <div style={{ marginBottom: '30px', background: '#f8f9fa', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #007bff' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', color: '#007bff' }}>
            Context & Background
          </h3>
          <p style={{ lineHeight: '1.6', color: '#495057', margin: 0 }}>
            {summary.context}
          </p>
        </div>
      )}

      {/* Discussion Topics */}
      {summary.discussion_topics?.length > 0 && (
        <Section title="Discussion Topics" icon="">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {summary.discussion_topics.map((topic, idx) => {
              const isObject = typeof topic === 'object' && topic !== null;
              const topicText = isObject ? (topic.topic || topic.name || JSON.stringify(topic)) : topic;
              return (
                <span key={idx} style={{
                  padding: '6px 12px',
                  background: '#e7f3ff',
                  color: '#0056b3',
                  borderRadius: '16px',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  {topicText}
                </span>
              );
            })}
          </div>
        </Section>
      )}

      {/* Detailed Discussion */}
      {summary.detailed_discussion?.length > 0 && (
        <Section title="Detailed Discussion" icon="">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {summary.detailed_discussion.map((point, idx) => {
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
        </Section>
      )}

      {/* Key Decisions */}
      {summary.key_decisions?.length > 0 && (
        <Section title="Key Decisions" icon="">
          <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
            {summary.key_decisions.map((decision, idx) => {
              const isObject = typeof decision === 'object' && decision !== null;
              const decisionText = isObject ? (decision.decision || decision.text || JSON.stringify(decision)) : decision;
              return (
                <li key={idx} style={{ marginBottom: '8px', color: '#495057' }}>
                  {decisionText}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* Technical Details */}
      {summary.technical_details?.length > 0 && (
        <Section title="Technical Details" icon="">
          <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
            {summary.technical_details.map((detail, idx) => {
              const isObject = typeof detail === 'object' && detail !== null;
              const detailText = isObject ? (detail.detail || detail.content || JSON.stringify(detail)) : detail;
              const reason = isObject && detail.reason ? ` (${detail.reason})` : '';
              return (
                <li key={idx} style={{ marginBottom: '8px', color: '#495057' }}>
                  {detailText}{reason}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* Mentor Feedback */}
      <MentorFeedback meeting={meeting} />

      {/* Wiki Update Suggestions */}
      <WikiUpdateSuggestions meeting={meeting} />
    </div>
  );
};

const Section = ({ title, icon, children }) => (
  <div style={{ marginBottom: '30px' }}>
    <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
      {icon} {title}
    </h3>
    {children}
  </div>
);

const AIModelBadge = ({ metadata }) => {
  try {
    const modelInfo = JSON.parse(metadata.ai_model_info);
    return (
      <div style={{
        marginBottom: '20px',
        padding: '12px 16px',
        background: modelInfo.fallbackOccurred
          ? 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)'
          : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
        borderRadius: '8px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        color: 'white',
        fontSize: '13px',
        fontWeight: '500',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <span style={{ fontSize: '18px' }}>
          {modelInfo.fallbackOccurred ? '' : ''}
        </span>
        <div>
          {modelInfo.fallbackOccurred ? (
            <>
              <div style={{ fontWeight: 'bold' }}>Analyzed with {modelInfo.usedModel} (Fallback)</div>
              <div style={{ fontSize: '11px', opacity: 0.9 }}>
                Primary API unavailable, automatically switched from {modelInfo.usedBackend === 'openai' ? 'Anthropic' : 'OpenAI'}
              </div>
            </>
          ) : (
            <div>Analyzed with {modelInfo.usedModel}</div>
          )}
        </div>
      </div>
    );
  } catch (e) {
    return null;
  }
};

export default MeetingSummary;
