export async function initAxe() {
  if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') {
    return;
  }

  const [{ default: axe }, React, ReactDOM] = await Promise.all([
    import('@axe-core/react'),
    import('react'),
    import('react-dom'),
  ]);

  axe(React, ReactDOM, 1000);
}
