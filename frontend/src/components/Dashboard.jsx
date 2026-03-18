import { useState } from 'react';
import CourseSizeTab from './CourseSizeTab';
import PlatformHistoryTab from './PlatformHistoryTab';
import TopUsersTab from './TopUsersTab';

export default function Dashboard({ selectedPlatform, userRole }) {
  const [tab, setTab] = useState('courses');

  if (!selectedPlatform) {
    return (
      <p className="empty">
        Selecciona una plataforma desde el Panel Global para ver su detalle.
      </p>
    );
  }

  return (
    <div className="section-stack detail-section">
      <div className="tabs-shell detail-tabs-shell">
        <div className="tabs" role="tablist" aria-label="Secciones del dashboard">
          <button
            className={`tab ${tab === 'courses' ? 'active' : ''}`}
            onClick={() => setTab('courses')}
          >
            Tamaño del curso
          </button>
          <button
            className={`tab ${tab === 'users' ? 'active' : ''}`}
            onClick={() => setTab('users')}
          >
            Usuarios (top 10)
          </button>
          <button
            className={`tab ${tab === 'history' ? 'active' : ''}`}
            onClick={() => setTab('history')}
          >
            Histórico
          </button>
        </div>
      </div>
      {tab === 'courses' ? (
        <CourseSizeTab
          moodleSource={selectedPlatform.source}
          platformName={selectedPlatform.name}
        />
      ) : tab === 'users' ? (
        <TopUsersTab
          moodleSource={selectedPlatform.source}
          platformName={selectedPlatform.name}
        />
      ) : (
        <PlatformHistoryTab
          moodleSource={selectedPlatform.source}
          platformName={selectedPlatform.name}
          userRole={userRole}
        />
      )}
    </div>
  );
}
