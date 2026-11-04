import type { ReactNode } from 'react';

/** The booth's touchscreen, zoomed in to fill the page. */
export function Monitor({
  title,
  sub,
  zoom,
  children,
}: {
  title: string;
  sub?: string;
  zoom?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="monitor-wrap">
      <div className={`monitor ${zoom ? 'zoom-in' : ''}`}>
        <i className="monitor-cam" aria-hidden="true" />
        <div className="monitor-screen">
          <header className="monitor-head">
            <h2>{title}</h2>
            {sub && <p>{sub}</p>}
          </header>
          {children}
        </div>
      </div>
    </main>
  );
}
