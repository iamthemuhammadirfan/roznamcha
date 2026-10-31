// "Who entered this, and when": a signature line at the foot of an entry, for the owner
// only. A munshi's phone shows nothing here — the owner checks the munshi, not the
// other way round.
//
// The badge says who at a glance: brand green for the owner, site yellow for a munshi.
// The clock icon says how far the time can be trusted: a cloud tick when it is the
// server's (received_at), a phone when only the phone's clock is known (entries from
// before the server stamped them).
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useMembers } from '@/db/hooks';
import { lang, t } from '@/i18n';
import { flagsFor, hasFlags, parseTimestamp } from '@/lib/attribution';
import { formatDay, toDay } from '@/lib/dates';
import { useMember, useSession } from '@/state/session';

import { Num, T } from './text';
import { colors, space } from './theme';

/** The columns every attributed entry has. */
export interface Attributable {
  created_by: string | null;
  created_at: string | null;
  received_at: string | null;
  /** The day the entry is for; absent for things that aren't dated. */
  date?: string | null;
}

type Person = { name: string; owner: boolean };

/**
 * Call once per screen. Returns null for anyone but the owner (and in local test mode,
 * where there is no server), so screens can skip the line altogether.
 */
export function useAttribution(): ((row: Attributable) => AttributionInfo) | null {
  const { role } = useMember();
  const { localMode } = useSession();
  const members = useMembers();
  const people = useMemo(() => {
    const m = new Map<string, Person>();
    for (const x of members)
      m.set(x.user_id, {
        name: x.name ?? x.email ?? t.audit.unknown,
        owner: x.role === 'owner',
      });
    return m;
  }, [members]);

  return useMemo(() => {
    if (role !== 'owner' || localMode) return null;
    return (row: Attributable) => {
      const person = (row.created_by && people.get(row.created_by)) || {
        name: t.audit.unknown,
        owner: false,
      };
      const server = row.received_at ? parseTimestamp(row.received_at) : null;
      const at = server ?? parseTimestamp(row.created_at);
      return {
        ...person,
        at,
        fromServer: server !== null,
        day: row.date ?? null,
        // Without the server's time there's nothing to check the phone against.
        flags: row.received_at ? flagsFor(row.date ?? null, row.created_at, row.received_at) : null,
      };
    };
  }, [role, localMode, people]);
}

export interface AttributionInfo {
  name: string;
  owner: boolean;
  at: Date | null;
  fromServer: boolean;
  day: string | null;
  flags: ReturnType<typeof flagsFor> | null;
}

function clock(at: Date) {
  return at.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** The signature line. `info` comes from useAttribution(); renders nothing without it. */
export function Attribution({ info }: { info: AttributionInfo | null | undefined }) {
  if (!info) return null;
  const { at, flags } = info;
  // On the entry's own day the time is enough; otherwise the date says it came later.
  const sameDay = at && info.day ? toDay(at) === info.day : false;
  return (
    <View style={styles.wrap}>
      <View style={styles.line} accessibilityLabel={`${t.audit.enteredBy} ${info.name}`}>
        <View style={[styles.badge, info.owner ? styles.badgeOwner : styles.badgeMunshi]}>
          <MaterialCommunityIcons
            name={info.owner ? 'account-tie' : 'account-hard-hat'}
            size={13}
            color={info.owner ? colors.white : colors.siteInk}
          />
        </View>
        <T variant="small" numberOfLines={1} style={styles.name}>
          {info.name}
        </T>
        {at ? (
          <View style={styles.when} accessibilityLabel={info.fromServer ? t.audit.serverTime : t.audit.phoneTime}>
            <MaterialCommunityIcons
              name={info.fromServer ? 'cloud-check-outline' : 'cellphone'}
              size={14}
              color={colors.muted}
            />
            {!sameDay ? <T variant="small">{formatDay(toDay(at), lang)}</T> : null}
            <Num style={styles.time}>{clock(at)}</Num>
          </View>
        ) : null}
      </View>
      {flags && hasFlags(flags) ? (
        <View style={styles.flags}>
          {flags.backdatedDays !== null ? (
            <Flag pre={t.audit.backdatedPre} n={flags.backdatedDays} post={t.audit.backdatedPost} />
          ) : null}
          {flags.uploadedLateHours !== null ? (
            <Flag pre={t.audit.latePre} n={flags.uploadedLateHours} post={t.audit.latePost} />
          ) : null}
          {flags.clockAhead ? <Flag pre={t.audit.clockAhead} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * One warning in words. It is a single Text that fills the line: shrink-wrapped Nastaliq
 * pieces lose their last word on Android. The number is its own span, so it keeps its
 * digits face.
 */
function Flag({ pre, n, post }: { pre: string; n?: number; post?: string }) {
  return (
    <View style={styles.flag}>
      <MaterialCommunityIcons name="alert-outline" size={14} color={colors.pending} />
      <T variant="small" style={[styles.flagText, { flex: 1 }]}>
        {pre ? `${pre} ` : ''}
        {n !== undefined ? (
          <Num bold style={styles.flagNum}>
            {n}
          </Num>
        ) : null}
        {post ? ` ${post}` : ''}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    marginTop: space.xs,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  badge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOwner: { backgroundColor: colors.brand },
  badgeMunshi: { backgroundColor: colors.site },
  name: { flex: 1, flexShrink: 1, color: colors.text },
  when: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  time: { fontSize: 13, lineHeight: 22, color: colors.muted },
  flags: { gap: 2 },
  flag: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  flagText: { color: colors.pending },
  flagNum: { fontSize: 13, lineHeight: 22, color: colors.pending },
});
