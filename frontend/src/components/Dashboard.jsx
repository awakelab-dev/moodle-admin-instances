import { useState } from 'react';
import CourseSizeTab from './CourseSizeTab';
import PlatformHistoryTab from './PlatformHistoryTab';
import TopUsersTab from './TopUsersTab';
import Breadcrumb from './Breadcrumb';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatPlatformDisplayName } from '@/lib/utils';

// Vista de detalle de una plataforma Moodle: se abre al hacer clic en una
// plataforma desde la pestaña "Storage". Solo organiza la navegación por
// pestañas (tamaño de curso, top usuarios, histórico); cada pestaña carga
// sus propios datos de forma independiente.
export default function Dashboard({ selectedPlatform, userRole, onBackToStorage }) {
  const [tab, setTab] = useState('courses');

  if (!selectedPlatform) {
    return (
      <p className="empty">
        Selecciona una plataforma desde Storage para ver su detalle.
      </p>
    );
  }

  return (
    <div className="section-stack detail-section">
      <Breadcrumb
        items={[
          { label: 'Storage', onClick: onBackToStorage },
          { label: formatPlatformDisplayName(selectedPlatform.name) },
        ]}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Secciones del dashboard">
          <TabsTrigger value="courses">Tamaño del curso</TabsTrigger>
          <TabsTrigger value="users">Usuarios (top 10)</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="courses">
          <CourseSizeTab
            moodleSource={selectedPlatform.source}
            platformName={formatPlatformDisplayName(selectedPlatform.name)}
          />
        </TabsContent>
        <TabsContent value="users">
          <TopUsersTab
            moodleSource={selectedPlatform.source}
            platformName={formatPlatformDisplayName(selectedPlatform.name)}
          />
        </TabsContent>
        <TabsContent value="history">
          <PlatformHistoryTab
            moodleSource={selectedPlatform.source}
            platformName={formatPlatformDisplayName(selectedPlatform.name)}
            userRole={userRole}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
