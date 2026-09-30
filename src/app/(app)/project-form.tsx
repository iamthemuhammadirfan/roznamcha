import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { useProject } from '@/db/hooks';
import type { Project } from '@/db/schema';
import { createProject, projectCodeTaken, setProjectActive, updateProject } from '@/db/mutations';
import { useActiveProject } from '@/state/active-project';
import { useMember, useWriteContext } from '@/state/session';
import { t } from '@/i18n';
import { Banner, Button, Field, Screen } from '@/ui/controls';

export default function ProjectFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useProject(id ?? null);
  // Wait for the row so the fields can start from it.
  if (id && !existing) return null;
  return <ProjectForm key={existing?.id ?? 'new'} existing={existing} />;
}

function ProjectForm({ existing }: { existing: Project | null }) {
  const id = existing?.id;
  const ctx = useWriteContext();
  const { role } = useMember();
  const { projectId, setProjectId } = useActiveProject();

  const [code, setCode] = useState(existing?.code ?? '');
  const [name, setName] = useState(existing?.name_ur ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Munshi can add projects but only the owner edits them (RLS enforces this too).
  const readOnly = Boolean(id) && role !== 'owner';

  async function save() {
    if (!code.trim() || !name.trim()) return setError(t.project.codeRequired);
    if (await projectCodeTaken(code, id)) return setError(t.project.codeTaken);
    setBusy(true);
    const input = { code, name_ur: name, address };
    if (id) {
      await updateProject(id, input);
      router.back();
    } else {
      const newId = await createProject(ctx, input);
      setProjectId(newId);
      // Open the new project; back from it returns to the list.
      router.replace({ pathname: '/project/[id]', params: { id: newId } });
    }
  }

  function toggleArchive() {
    if (!existing) return;
    Alert.alert(existing.is_active ? t.project.archive : t.project.unarchive, `${existing.code} ${existing.name_ur}`, [
      { text: t.action.cancel, style: 'cancel' },
      {
        text: t.action.confirm,
        onPress: async () => {
          await setProjectActive(existing.id, !existing.is_active);
          if (existing.is_active && projectId === existing.id) setProjectId(null);
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen>
      {error ? <Banner tone="recover" text={error} /> : null}
      <Field label={t.project.code} value={code} onChangeText={setCode} editable={!readOnly} style={{ writingDirection: "ltr" }} />
      <Field label={t.project.name} value={name} onChangeText={setName} editable={!readOnly} />
      <Field label={t.project.address} value={address} onChangeText={setAddress} editable={!readOnly} />
      {!readOnly ? <Button label={t.action.save} onPress={save} busy={busy} /> : null}
      {existing && role === 'owner' ? (
        <Button
          label={existing.is_active ? t.project.archive : t.project.unarchive}
          kind="secondary"
          onPress={toggleArchive}
        />
      ) : null}
    </Screen>
  );
}
