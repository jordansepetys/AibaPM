import { forwardRef } from 'react';

const TabButton = forwardRef(({
  active,
  onClick,
  onKeyDown,
  icon,
  label,
  count,
  tabIndex = 0,
}, ref) => {
  return (
    <button
      ref={ref}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={tabIndex}
      role="tab"
      aria-selected={active}
      className={`tab-button ${active ? 'tab-button--active' : ''}`}
    >
      <span className="tab-button__icon">{icon}</span>
      <span className="tab-button__label">{label}</span>
      {count !== undefined && (
        <span className="tab-button__badge">{count}</span>
      )}
    </button>
  );
});

TabButton.displayName = 'TabButton';

export default TabButton;
