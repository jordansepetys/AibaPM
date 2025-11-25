const SkillCard = ({ skill, onEdit, onDelete }) => {
  return (
    <div className="skill-card">
      <div className="skill-card__content">
        <div className="skill-card__header">
          <h4 className="skill-card__name">{skill.name}</h4>
          {skill.isGlobal && (
            <span className="skill-card__badge skill-card__badge--global">
              GLOBAL
            </span>
          )}
          {!skill.autoActivate && (
            <span className="skill-card__badge skill-card__badge--manual">
              MANUAL
            </span>
          )}
        </div>
        {skill.description && (
          <p className="skill-card__description">{skill.description}</p>
        )}
        {skill.triggerKeywords && skill.triggerKeywords.length > 0 && (
          <div className="skill-card__keywords">
            <span className="skill-card__keywords-label">Keywords:</span>
            {skill.triggerKeywords.map((keyword, idx) => (
              <span key={idx} className="skill-card__keyword">
                {keyword}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="skill-card__actions">
        <button
          onClick={() => onEdit(skill)}
          className="skill-card__btn skill-card__btn--edit"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(skill.id, skill.name)}
          className="skill-card__btn skill-card__btn--delete"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default SkillCard;
