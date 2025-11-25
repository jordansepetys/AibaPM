const Skeleton = ({ width, height, borderRadius = '8px', className = '' }) => {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width: width || '100%',
        height: height || '20px',
        borderRadius,
      }}
    />
  );
};

export const SkeletonCard = ({ height = '120px' }) => {
  return (
    <div className="skeleton-card">
      <Skeleton height="14px" width="40%" style={{ marginBottom: '12px' }} />
      <Skeleton height="42px" width="60%" />
    </div>
  );
};

export const SkeletonText = ({ lines = 3 }) => {
  return (
    <div className="skeleton-text">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="16px"
          width={i === lines - 1 ? '70%' : '100%'}
          style={{ marginBottom: '8px' }}
        />
      ))}
    </div>
  );
};

export default Skeleton;
