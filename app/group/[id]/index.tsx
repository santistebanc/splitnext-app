import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import {
  assumedMemberIdFromBinds,
  bindingIsOpen,
} from '@/src/domain/assumedMember';
import {
  activitiesFromOthers,
  activityLines,
  formatActivityLine,
  type ActivityLine,
} from '@/src/domain/activity';
import { computeBalances } from '@/src/domain/balances';
import { lobbyGroupTitle } from '@/src/domain/lobby';
import { getGroupStore } from '@/src/store/groupStore';
import { addMember, openGroup } from '@/src/sync/groupSync';
import { coerceSyncError } from '@/src/sync/syncErrors';
import { ActivityRow } from '@/src/ui/ActivityRow';
import { ActivityToast } from '@/src/ui/ActivityToast';
import { formatMoney, memberLabel } from '@/src/ui/format';
import { colors } from '@/src/ui/theme';
import { useValue } from '@legendapp/state/react';
import { SymbolView } from 'expo-symbols';
import { useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ActivityEntity } from '@/src/types/group';

const TYPE_MAX = 48;
const TYPE_MIN = 14;
const ADD_ROW_H = 56;
const TITLE_FALLBACK_H = 58;
const ROW_PAD_X = 32;
const COL_GAP = 16;
/** Leave room for a short name; longer names ellipsize. Amounts never clip. */
const NAME_RESERVE = 88;
/** `+999999.00` — six-digit whole with cents; type is sized so this never clips. */
const AMOUNT_FIT_CENTS = 99_999_900;
const AMT_EM = 0.6;
const TYPE_LINE = 1.25;

/** Few people → larger type, many → smaller, no scroll. Width-capped by the
 *  6-digit amount staying fully visible; names ellipsize if they must. */
function typeSizeFor(
  count: number,
  areaH: number,
  areaW: number,
  currency: string,
  namesOnly: boolean,
  titleH: number,
): number {
  const fromHeight = (() => {
    if (count <= 0 || areaH <= 0) return TYPE_MAX;
    const usable = Math.max(80, areaH - ADD_ROW_H - 2 * titleH);
    return (usable / count - 8) / TYPE_LINE;
  })();
  const amt = formatMoney(AMOUNT_FIT_CENTS, currency, true);
  const inner = Math.max(
    1,
    (areaW > 0 ? areaW : 420) - ROW_PAD_X - COL_GAP,
  );
  const fromWidth = namesOnly
    ? TYPE_MAX
    : (inner - NAME_RESERVE) / (AMT_EM * amt.length);
  return Math.round(
    Math.min(TYPE_MAX, Math.max(TYPE_MIN, Math.min(fromHeight, fromWidth))),
  );
}

export default function GroupHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id ?? '';
  const router = useRouter();
  const navigation = useNavigation();
  const store$ = getGroupStore(groupId);
  const group = useValue(store$.group);
  const members = useValue(store$.members);
  const binds = useValue(store$.binds);
  const expenses = useValue(store$.expenses);
  const activities = useValue(store$.activities);
  const lastErrorRaw = useValue(store$.lastError);
  const lastError = coerceSyncError(lastErrorRaw);
  const [deviceUserId, setDeviceUserId] = useState<string | null>(null);
  const addRef = useRef<TextInput>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [areaH, setAreaH] = useState(0);
  const [areaW, setAreaW] = useState(0);
  const [titleH, setTitleH] = useState(TITLE_FALLBACK_H);
  const [syncReady, setSyncReady] = useState(false);
  const [toastLine, setToastLine] = useState<ActivityLine | null>(null);
  const knownActivityIdsRef = useRef<Set<string>>(new Set());

  const dismissToast = useCallback(() => setToastLine(null), []);

  useEffect(() => {
    if (!groupId) return;
    setSyncReady(false);
    setToastLine(null);
    knownActivityIdsRef.current = new Set();
    void getOrCreateDeviceUserId().then(setDeviceUserId);
    void (async () => {
      await openGroup(groupId);
      const live = store$.activities.get() ?? {};
      knownActivityIdsRef.current = new Set(
        Object.entries(live)
          .filter(([, activity]) => activity.deleted_at == null)
          .map(([id]) => id),
      );
      setSyncReady(true);
    })();
  }, [groupId, store$]);

  const title = lobbyGroupTitle(group.name);
  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: '',
      headerTitle: () => null,
      headerLeft: () => (
        <Pressable
          onPress={() => router.navigate('/')}
          accessibilityRole="button"
          accessibilityLabel="Home"
          style={styles.headerHome}
        >
          <SymbolView
            name={{ ios: 'house', android: 'home', web: 'home' }}
            size={22}
            tintColor={colors.ink}
          />
        </Pressable>
      ),
      headerRight: () => (
        <Pressable
          onPress={() => router.push(`/group/${groupId}/settings` as Href)}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={styles.headerSettings}
        >
          <Text style={styles.headerSettingsText}>⚙</Text>
        </Pressable>
      ),
    });
  }, [navigation, router, groupId]);

  useEffect(() => {
    if (addOpen) addRef.current?.focus();
  }, [addOpen]);

  const assumedMemberId = useMemo(
    () =>
      deviceUserId
        ? assumedMemberIdFromBinds(binds ?? {}, deviceUserId)
        : null,
    [binds, deviceUserId],
  );

  const balances = useMemo(
    () => computeBalances(members ?? {}, expenses ?? {}),
    [members, expenses],
  );
  const namesOnly = bindingIsOpen(expenses ?? {});
  const currency = group.currency_label || 'EUR';
  const typeSize = typeSizeFor(
    balances.length,
    areaH,
    areaW,
    currency,
    namesOnly,
    titleH,
  );
  const typeLine = Math.round(typeSize * TYPE_LINE);

  const allActivityLines = useMemo(
    () =>
      activityLines(
        activities ?? {},
        members ?? {},
        expenses ?? {},
        currency,
        assumedMemberId,
      ),
    [activities, members, expenses, currency, assumedMemberId],
  );
  const recentActivityLines = allActivityLines.slice(0, 3);

  useEffect(() => {
    if (!syncReady || !assumedMemberId) return;
    const after = activities ?? {};
    const known = knownActivityIdsRef.current;
    const before = Object.fromEntries(
      [...known]
        .filter((id) => after[id])
        .map((id) => [id, after[id] as ActivityEntity]),
    );

    for (const activity of Object.values(after)) {
      if (activity.deleted_at != null) continue;
      if (activity.actor_member_id === assumedMemberId || before[activity.id]) {
        known.add(activity.id);
      }
    }

    const foreign = activitiesFromOthers(before, after, assumedMemberId);
    if (foreign.length === 0) return;

    const line = formatActivityLine(
      foreign[0],
      members ?? {},
      expenses ?? {},
      currency,
      assumedMemberId,
    );
    if (!line) return;

    setToastLine(line);
    for (const activity of foreign) {
      known.add(activity.id);
    }
  }, [
    syncReady,
    activities,
    assumedMemberId,
    members,
    expenses,
    currency,
  ]);

  const onAdd = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      await addMember(groupId, newName);
      setNewName('');
      setAddOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.body} testID="balances">
        {lastError ? (
          <Text style={styles.error}>
            {lastError.code}: {lastError.message}
          </Text>
        ) : null}

        <View
          style={styles.centered}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setAreaW(width);
            setAreaH(height);
          }}
        >
          <View style={styles.titleArea}>
            <Text
              testID="group-title"
              style={styles.groupTitle}
              numberOfLines={2}
              ellipsizeMode="tail"
              accessibilityRole="header"
              onLayout={(e) => setTitleH(e.nativeEvent.layout.height)}
            >
              {title}
            </Text>
          </View>
          {balances.length === 0 ? (
            <Text style={styles.hint}>No members yet.</Text>
          ) : (
            <>
            <View style={styles.list}>
              {namesOnly
                ? balances.map((b) => {
                    const isYou = b.member_id === assumedMemberId;
                    const label = memberLabel(b.display_name, isYou);
                    return (
                      <Pressable
                        key={b.member_id}
                        style={[styles.balRow, isYou ? styles.balRowYou : null]}
                        onPress={() =>
                          router.push(
                            `/group/${groupId}/member/${b.member_id}` as Href,
                          )
                        }
                        accessibilityRole="button"
                        accessibilityLabel={label}
                      >
                        <Text
                          style={[
                            styles.rosterName,
                            isYou ? styles.balNameYou : null,
                            { fontSize: typeSize, lineHeight: typeLine },
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })
                : balances.map((b) => {
                    const isYou = b.member_id === assumedMemberId;
                    const label = memberLabel(b.display_name, isYou);
                    const amt = formatMoney(b.net_cents, currency, true);
                    const amtStyle =
                      b.net_cents > 0
                        ? styles.amtPos
                        : b.net_cents < 0
                          ? styles.amtNeg
                          : styles.amt;
                    return (
                      <Pressable
                        key={b.member_id}
                        testID="balance-row"
                        style={[styles.balRow, isYou ? styles.balRowYou : null]}
                        onPress={() =>
                          router.push(
                            `/group/${groupId}/member/${b.member_id}` as Href,
                          )
                        }
                        accessibilityRole="button"
                        accessibilityLabel={label}
                      >
                        <Text
                          style={[
                            styles.balName,
                            isYou ? styles.balNameYou : null,
                            { fontSize: typeSize, lineHeight: typeLine },
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {label}
                        </Text>
                        <Text
                          style={[
                            amtStyle,
                            isYou ? styles.amtYou : null,
                            {
                              fontSize: typeSize,
                              lineHeight: typeLine,
                            },
                          ]}
                        >
                          {amt}
                        </Text>
                      </Pressable>
                    );
                  })}
            </View>

            <View style={styles.addRow}>
              {addOpen ? (
                <TextInput
                  ref={addRef}
                  testID="add-member-field"
                  style={styles.addField}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Member name"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={() => void onAdd()}
                  onBlur={() => setAddOpen(false)}
                  editable={!busy}
                />
              ) : (
                <Pressable
                  testID="add-member"
                  style={styles.addPlus}
                  onPress={() => setAddOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Add member"
                >
                  <Text style={styles.addPlusLabel}>add member</Text>
                  <View style={styles.addPlusMark} pointerEvents="none">
                    <View style={styles.addPlusBarH} />
                    <View style={styles.addPlusBarV} />
                  </View>
                </Pressable>
              )}
            </View>

            <View style={styles.titleSpacer} pointerEvents="none" />

            {!namesOnly && recentActivityLines.length > 0 ? (
              <View testID="activity-recent" style={styles.activitySection}>
                <Text style={styles.activityHeading}>Recent activity</Text>
                {recentActivityLines.map((line) => (
                  <ActivityRow
                    key={line.id}
                    line={line}
                    lineStyle={styles.activityLine}
                    testID="activity-recent-row"
                  />
                ))}
                <Pressable
                  testID="activity-view-all"
                  style={styles.activityViewAll}
                  onPress={() =>
                    router.push(`/group/${groupId}/activity` as Href)
                  }
                  accessibilityRole="button"
                  accessibilityLabel="View all events"
                >
                  <Text style={styles.activityViewAllText}>View all events</Text>
                </Pressable>
              </View>
            ) : null}
            </>
          )}
          {balances.length === 0 ? (
            <View style={styles.titleSpacer} pointerEvents="none" />
          ) : null}
        </View>
      </View>

      {assumedMemberId ? (
        <View style={[styles.fabBar, !namesOnly ? styles.fabBarRaised : null]}>
          <Pressable
            style={styles.fab}
            onPress={() => router.push(`/group/${groupId}/expense/new` as Href)}
            accessibilityRole="button"
            accessibilityLabel="Add expense"
          >
            <Text style={styles.fabText}>+ Expense</Text>
          </Pressable>
        </View>
      ) : null}

      {!namesOnly ? (
        <Pressable
          style={styles.expensesBar}
          onPress={() => router.push(`/group/${groupId}/expenses` as Href)}
          accessibilityRole="button"
          accessibilityLabel="View all expenses"
        >
          <Text style={styles.expensesBarText}>View all expenses</Text>
        </Pressable>
      ) : null}

      <ActivityToast
        line={toastLine}
        onDismiss={dismissToast}
        onPress={() => {
          dismissToast();
          router.push(`/group/${groupId}/activity` as Href);
        }}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  body: {
    flex: 1,
    paddingBottom: 80,
  },
  centered: {
    flex: 1,
  },
  titleArea: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
  },
  titleSpacer: {
    flex: 1,
    minHeight: 0,
  },
  list: {},
  groupTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    paddingHorizontal: 24,
    width: '100%',
  },
  headerHome: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSettings: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSettingsText: {
    fontSize: 18,
    color: colors.muted,
  },
  error: {
    color: colors.danger,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  hint: {
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
    textAlign: 'center',
  },
  balRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  balRowYou: {
    backgroundColor: colors.youRow,
  },
  rosterName: {
    flex: 1,
    minWidth: 0,
    fontWeight: '600',
    color: colors.ink,
    textAlign: 'right',
  },
  balName: {
    flex: 1,
    minWidth: 0,
    fontWeight: '600',
    color: colors.ink,
    textAlign: 'right',
    paddingRight: 16,
  },
  balNameYou: {
    fontWeight: '700',
  },
  amt: {
    flexGrow: 0,
    flexShrink: 0,
    fontFamily: 'monospace',
    fontWeight: '600',
    color: colors.ink,
    textAlign: 'left',
  },
  amtPos: {
    flexGrow: 0,
    flexShrink: 0,
    fontFamily: 'monospace',
    fontWeight: '600',
    color: colors.accent,
    textAlign: 'left',
  },
  amtNeg: {
    flexGrow: 0,
    flexShrink: 0,
    fontFamily: 'monospace',
    fontWeight: '600',
    color: colors.warn,
    textAlign: 'left',
  },
  amtYou: {
    fontWeight: '700',
  },
  activitySection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  activityHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 8,
  },
  activityLine: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
    paddingVertical: 4,
  },
  activityViewAll: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  activityViewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  addRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 2,
  },
  addPlus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
    paddingHorizontal: 8,
  },
  addPlusMark: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: 1.5 }],
  },
  addPlusBarH: {
    position: 'absolute',
    width: 14,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: colors.muted,
  },
  addPlusBarV: {
    position: 'absolute',
    width: 1.5,
    height: 14,
    borderRadius: 1,
    backgroundColor: colors.muted,
  },
  addPlusLabel: {
    fontSize: 13,
    lineHeight: 13,
    fontWeight: '500',
    color: colors.muted,
    includeFontPadding: false,
  },
  addField: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
  },
  fabBar: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    pointerEvents: 'box-none',
  },
  fabBarRaised: {
    bottom: 72,
  },
  expensesBar: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  expensesBarText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  fab: {
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  fabText: {
    color: colors.accentInk,
    fontSize: 14,
    fontWeight: '600',
  },
});
