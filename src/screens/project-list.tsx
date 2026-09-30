import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { balancesByAssignment, useAllAssignments, useAllAttendance, useAllEntries, useProjectsLoaded } from '@/db/hooks';
import { useActiveProject } from '@/state/active-project';
import { useSession } from '@/state/session';
import { t } from '@/i18n';
import { BalanceChip } from '@/ui/balance-chip';
import { Banner, Button, Card, Empty, Row, Screen } from '@/ui/controls';
import { Num, T } from '@/ui/text';
import { NotSaved, UpdateBanner } from '@/ui/status-banners';
import { colors } from '@/ui/theme';

/**
 * Home: every project with its headline outstanding and worker count. Tapping one makes
 * it the active project and opens its dashboard on top, so back returns here.
 */
export function ProjectList() {
  const { localMode } = useSession();
  const { projectId, setProjectId } = useActiveProject();
  const { projects, loading } = useProjectsLoaded();
  const assignments = useAllAssignments();
  const balances = balancesByAssignment(useAllAttendance(), useAllEntries());
  const [showArchived, setShowArchived] = useState(false);

  const summary = (pid: string) => {
    const mine = assignments.filter((a) => a.project_id === pid);
    return {
      workers: mine.filter((a) => a.is_active).length,
      outstanding: mine.reduce((sum, a) => sum + (balances.get(a.id)?.balance ?? 0), 0),
    };
  };

  const visible = projects.filter((p) => p.is_active || showArchived);
  const archivedCount = projects.filter((p) => !p.is_active).length;

  function open(id: string) {
    setProjectId(id);
    router.push({ pathname: '/project/[id]', params: { id } });
  }

  return (
    <Screen>
      {localMode ? <Banner text={t.app.localMode} /> : null}
      <UpdateBanner />
      <NotSaved />
      {!loading && visible.length === 0 ? <Empty text={t.project.empty} /> : null}
      {visible.map((p) => {
        const s = summary(p.id);
        return (
          <Card
            key={p.id}
            onPress={() => open(p.id)}
            style={p.id === projectId ? { borderColor: colors.brand, borderWidth: 2 } : undefined}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row>
                <Num bold style={{ fontSize: 26, lineHeight: 38, color: colors.brand }}>
                  {p.code}
                </Num>
                <T variant="h2">{p.name_ur}</T>
              </Row>
              <Pressable hitSlop={16} onPress={() => router.push({ pathname: '/project-form', params: { id: p.id } })}>
                <T variant="small" style={{ color: colors.brand }}>
                  {t.action.edit}
                </T>
              </Pressable>
            </Row>
            {!p.is_active ? <T variant="small">{t.project.archived}</T> : null}
            <Row style={{ justifyContent: 'space-between' }}>
              <Row>
                <Num>{s.workers}</Num>
                <T variant="small">{t.project.workerCount}</T>
              </Row>
              <BalanceChip paisa={s.outstanding} />
            </Row>
          </Card>
        );
      })}
      {archivedCount > 0 ? (
        <Pressable onPress={() => setShowArchived(!showArchived)} style={{ padding: 12 }}>
          <T variant="small" style={{ color: colors.brand, textAlign: 'center' }}>
            {showArchived ? t.project.hideArchived : t.project.showArchived}
          </T>
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }} />
      <Button label={t.project.new} kind="secondary" onPress={() => router.push('/project-form')} />
    </Screen>
  );
}
