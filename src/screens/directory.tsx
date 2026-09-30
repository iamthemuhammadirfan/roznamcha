import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { useAllAssignments, useProjects, useWorkers } from '@/db/hooks';
import { useActiveProject } from '@/state/active-project';
import { t, tradeLabel } from '@/i18n';
import { Button, Card, Empty, Field, Phone, Row, Screen } from '@/ui/controls';
import { Num, T } from '@/ui/text';
import { colors, TOUCH_MIN } from '@/ui/theme';

/**
 * The global worker directory. As a tab, tapping a person opens their ledger. In pick
 * mode ("add worker" on a project) tapping a person goes on to assign them to the
 * active project — searching here first is what stops duplicate people.
 */
export function Directory({ picking = false }: { picking?: boolean }) {
  const { projectId } = useActiveProject();
  const workers = useWorkers();
  const assignments = useAllAssignments();
  const projects = useProjects();
  const [q, setQ] = useState('');

  const codeOf = new Map(projects.map((p) => [p.id, p.code]));
  const query = q.trim();
  const digits = query.replace(/\D/g, '');
  const filtered = workers.filter((w) => {
    if (!query) return true;
    if (digits.length >= 3 && w.phone?.replace(/\D/g, '').includes(digits)) return true;
    return w.name_ur.includes(query) || (w.father_name ?? '').includes(query);
  });

  function onPick(workerId: string) {
    if (!picking) {
      router.push({ pathname: '/worker/[id]', params: { id: workerId } });
      return;
    }
    const already = assignments.some((a) => a.worker_id === workerId && a.project_id === projectId && a.is_active);
    if (already) {
      Alert.alert(t.assignment.alreadyOn);
      return;
    }
    router.push({ pathname: '/assign', params: { workerId } });
  }

  return (
    <Screen>
      <Field label={t.worker.search} value={q} onChangeText={setQ} autoFocus={picking} />
      {filtered.length === 0 ? <Empty text={t.worker.notFound} /> : null}
      {filtered.map((w) => {
        const on = assignments.filter((a) => a.worker_id === w.id && a.is_active);
        return (
          <Card key={w.id} onPress={() => onPick(w.id)} style={{ minHeight: TOUCH_MIN }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flexShrink: 1 }}>
                <T variant="h2" style={{ fontSize: 20 }}>
                  {w.name_ur}
                </T>
                {w.father_name ? (
                  <T variant="small">
                    {t.worker.son} {w.father_name}
                  </T>
                ) : null}
                <Phone value={w.phone} />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {w.trade ? <T variant="small">{tradeLabel(w.trade)}</T> : null}
                {on.length ? (
                  <Row>
                    {on.map((a) => (
                      <Num key={a.id} bold style={{ color: colors.brand }}>
                        {codeOf.get(a.project_id)}
                      </Num>
                    ))}
                  </Row>
                ) : (
                  <T variant="small">{t.worker.noProjects}</T>
                )}
              </View>
            </Row>
          </Card>
        );
      })}
      <Button
        label={t.worker.createNew}
        kind="secondary"
        onPress={() =>
          router.push({ pathname: '/worker-form', params: picking ? { assign: '1', name: query } : { name: query } })
        }
      />
    </Screen>
  );
}
