import { useState } from 'react';
import CourseSizeTab from './CourseSizeTab';
import PlatformHistoryTab from './PlatformHistoryTab';
import TopUsersTab from './TopUsersTab';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatPlatformDisplayName } from '@/lib/utils';

export default function Dashboard({ selectedPlatform, userRole }) {
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
