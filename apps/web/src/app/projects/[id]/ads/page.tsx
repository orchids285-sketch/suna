'use client';

import { useParams } from 'next/navigation';

import { ProjectShell } from '@/components/projects/project-shell';
import { BirchWorkspace } from '@/components/birch/birch-workspace';

/**
 * Ad automations — the Bïrch surface, mounted inside the project shell so it
 * shares Suna's sidebar, fonts and chrome. The shell handles auth + the
 * sidebar; BirchWorkspace owns the ad-automation experience.
 */
export default function ProjectAdsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  return (
    <ProjectShell projectId={projectId}>
      <BirchWorkspace projectId={projectId} />
    </ProjectShell>
  );
}
