import { getOrCreateDeviceUserId } from '@/src/device/deviceUser';
import {
  assumedMemberIdFromBinds,
  bindingIsOpen,
  memberIsClaimed,
} from '@/src/domain/assumedMember';
import { computeBalances } from '@/src/domain/balances';
import {
  memberBuckets,
  type BucketLine,
} from '@/src/domain/buckets';
import { expenseEditHref, settlementHref } from '@/src/domain/expensePrefill';
import { patchMember } from '@/src/domain/member';
import {
  settlementsForMember,
  suggestSettlements,
} from '@/src/domain/settle';
import { getGroupStore } from '@/src/store/groupStore';
import { mintInvite } from '@/src/sync/invite';
import { inviteShareText } from '@/src/sync/inviteShareText';
import { openGroup, updateMember, deleteMember } from '@/src/sync/groupSync';
import { coerceSyncError } from '@/src/sync/syncErrors';
import { ConfirmDrawer } from '@/src/ui/ConfirmDrawer';
import { formatMoney, memberLabel } from '@/src/ui/format';
import { colors } from '@/src/ui/theme';
import { useValue } from '@legendapp/state/react';
import { SymbolView } from 'expo-symbols';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

async function copyText(text: string): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    }
  } catch {
    // The visible join link is the fallback.
  }
}

async function shareText(text: string): Promise<void> {
  try {
    await Share.share({ message: text });
  } catch {
    // Dismissed, or this platform has no share sheet.
  }
}

function bucketLineLabel(
  line: BucketLine,
  nameOf: (id: string) => string,
): string {
  const desc = line.description || '(no description)';
  const names = line.counterpart_ids.map(nameOf);
  return names.length > 0 ? `${desc} · ${names.join(' + ')}` : desc;
}

type Props = {
  groupId: string;
  memberId: string;
  onClose: () => void;
};

export function MemberDetail({ groupId, memberId: targetId, onClose }: Props) {
  const router = useRouter();
  const store$ = getGroupStore(groupId);
  const group = useValue(store$.group);
  const members = useValue(store$.members);
  const binds = useValue(store$.binds);
  const expenses = useValue(store$.expenses);
  const lastErrorRaw = useValue(store$.lastError);
  const lastError = coerceSyncError(lastErrorRaw);
  const [deviceUserId, setDeviceUserId] = useState<string | null>(null);
  const [joinLink, setJoinLink] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  const editingRef = useRef(false);
  const draftNameRef = useRef('');
  const nameRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!groupId) return;
    void openGroup(groupId);
    void getOrCreateDeviceUserId().then(setDeviceUserId);
  }, [groupId]);

  const assumedMemberId = useMemo(
    () =>
      deviceUserId
        ? assumedMemberIdFromBinds(binds ?? {}, deviceUserId)
        : null,
    [binds, deviceUserId],
  );

  const member = (members ?? {})[targetId];
  const isYou = targetId === assumedMemberId;
  const claimed = memberIsClaimed(binds ?? {}, targetId);
  const showInvite = !claimed && member != null && member.deleted_at == null;
  const namesOnly = bindingIsOpen(expenses ?? {});
  const subjectName = member
    ? memberLabel(member.display_name, false)
    : '(unnamed)';
  const canEditName = member != null && member.deleted_at == null;
  const canRemove =
    member != null &&
    member.deleted_at == null &&
    !isYou &&
    !claimed;

  useEffect(() => {
    if (member && !editingRef.current) {
      draftNameRef.current = member.display_name;
    }
  }, [member?.display_name]);

  const balances = useMemo(
    () => computeBalances(members ?? {}, expenses ?? {}),
    [members, expenses],
  );
  const net = balances.find((b) => b.member_id === targetId)?.net_cents ?? 0;
  const transfers = useMemo(
    () => settlementsForMember(suggestSettlements(balances), targetId),
    [balances, targetId],
  );
  const buckets = useMemo(
    () => memberBuckets(targetId, members ?? {}, expenses ?? {}),
    [targetId, members, expenses],
  );

  const nameOf = (id: string) => {
    const m = (members ?? {})[id];
    return memberLabel(m?.display_name ?? '', id === assumedMemberId);
  };

  const currency = group.currency_label;
  const paidHeading = isYou ? 'You paid for' : `${subjectName} paid for`;
  const owesHeading = isYou ? 'You owe for' : `${subjectName} owes for`;

  useEffect(() => {
    if (!showInvite || !groupId || !targetId) {
      setJoinLink(null);
      setInviteBusy(false);
      return;
    }
    let cancelled = false;
    setInviteBusy(true);
    void mintInvite(groupId, targetId).then((token) => {
      if (cancelled) return;
      setJoinLink(token ? inviteShareText(token) : null);
      setInviteBusy(false);
    });
    return () => {
      cancelled = true;
    };
  }, [showInvite, groupId, targetId]);

  const openEdit = () => {
    if (member == null || member.deleted_at != null) return;
    draftNameRef.current = member.display_name;
    editingRef.current = true;
    setEditing(true);
  };

  const closeEdit = async () => {
    if (!editingRef.current) return;
    editingRef.current = false;
    setEditing(false);
    const next = draftNameRef.current;
    if (
      member != null &&
      member.deleted_at == null &&
      patchMember(member, next, member.updated_at) != null
    ) {
      await updateMember(groupId, targetId, next);
    } else if (member) {
      draftNameRef.current = member.display_name;
    }
  };

  const onRemove = async () => {
    if (!canRemove || removeBusy) return;
    setRemoveBusy(true);
    try {
      await deleteMember(groupId, targetId);
      onClose();
    } finally {
      setRemoveBusy(false);
      setConfirmingRemove(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.head}>
        {editing && canEditName ? (
          <TextInput
            ref={nameRef}
            testID="member-name"
            style={styles.headerField}
            defaultValue={draftNameRef.current}
            onChangeText={(text) => {
              draftNameRef.current = text;
            }}
            placeholder="Name"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={() => void closeEdit()}
            onBlur={() => void closeEdit()}
          />
        ) : (
          <Text
            testID="member-name-label"
            style={styles.headerTitle}
            numberOfLines={1}
          >
            {subjectName}
          </Text>
        )}
        <View style={styles.headActions}>
          {canEditName && !editing ? (
            <Pressable
              testID="member-edit"
              style={styles.editBtn}
              onPress={openEdit}
              accessibilityRole="button"
              accessibilityLabel="Edit name"
            >
              <Text style={styles.editIcon}>✎</Text>
            </Pressable>
          ) : null}
          <Pressable
            testID="member-close"
            style={styles.editBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    <ScrollView contentContainerStyle={styles.container}>
      {showInvite ? (
        <View style={styles.invite}>
          <Text style={styles.sec}>invite link</Text>
          <View style={styles.inviteRow}>
            <TextInput
              testID="invite-link"
              style={styles.inviteField}
              value={joinLink ?? ''}
              editable={false}
              selectTextOnFocus
              placeholder="Invite link"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Join link"
            />
            <Pressable
              testID="invite-copy"
              style={[styles.inviteIconBtn, !joinLink ? styles.disabled : null]}
              onPress={() => {
                if (joinLink) void copyText(joinLink);
              }}
              accessibilityRole="button"
              accessibilityLabel="Copy invite link"
              disabled={!joinLink || inviteBusy}
            >
              <SymbolView
              name={{
                ios: 'doc.on.doc',
                android: 'content_copy',
                web: 'content_copy',
              }}
              size={22}
              tintColor={colors.accent}
            />
            </Pressable>
            <Pressable
              testID="invite-share"
              style={[styles.inviteIconBtn, !joinLink ? styles.disabled : null]}
              onPress={() => {
                if (joinLink) void shareText(joinLink);
              }}
              accessibilityRole="button"
              accessibilityLabel="Share invite link"
              disabled={!joinLink || inviteBusy}
            >
              <SymbolView
              name={{
                ios: 'square.and.arrow.up',
                android: 'ios_share',
                web: 'ios_share',
              }}
              size={22}
              tintColor={colors.accent}
            />
            </Pressable>
          </View>
        </View>
      ) : null}

      {!namesOnly ? (
        <>
      {buckets.paidFor.length > 0 ? (
      <Bucket
        testID="paid-for"
        heading={paidHeading}
        lines={buckets.paidFor}
        currency={currency}
        nameOf={nameOf}
        onOpen={(expenseId) =>
          router.push(expenseEditHref(groupId, expenseId) as Href)
        }
      />
      ) : null}
      {buckets.owesFor.length > 0 ? (
      <Bucket
        testID="owes-for"
        heading={owesHeading}
        lines={buckets.owesFor}
        currency={currency}
        nameOf={nameOf}
        onOpen={(expenseId) =>
          router.push(expenseEditHref(groupId, expenseId) as Href)
        }
      />
      ) : null}

      <View style={styles.netRow}>
        <Text style={styles.netLabel}>Net balance</Text>
        <Text
          style={[
            styles.netAmt,
            net > 0 ? styles.amtPos : net < 0 ? styles.amtNeg : null,
          ]}
        >
          {formatMoney(net, currency, true)}
        </Text>
      </View>

      {transfers.length > 0 ? (
        <View testID="settle" style={styles.settle}>
          <Text style={styles.sec}>Suggested settlement</Text>
          {transfers.map((s, i) => {
            const amount = formatMoney(s.amount_cents, currency);
            const to = nameOf(s.to_member_id);
            const from = nameOf(s.from_member_id);
            const label = isYou
              ? `Pay ${amount} to ${to}`
              : `${from} pays ${amount} to ${to}`;
            return (
              <View
                key={`${s.from_member_id}-${s.to_member_id}-${i}`}
                style={styles.settleRow}
              >
                <Text style={styles.settleText}>{label}</Text>
                <Pressable
                  testID="settle-row"
                  style={styles.settleBtn}
                  onPress={() => router.push(settlementHref(groupId, s) as Href)}
                  accessibilityRole="button"
                  accessibilityLabel={`Settle: ${label}`}
                >
                  <Text style={styles.settleBtnText}>Settle</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}
        </>
      ) : null}

      {lastError ? (
        <Text style={styles.err}>
          {lastError.code}: {lastError.message}
        </Text>
      ) : null}

      {canRemove ? (
        <View style={styles.footer}>
          <Pressable
            testID="member-remove"
            style={[styles.remove, removeBusy ? styles.disabled : null]}
            onPress={() => setConfirmingRemove(true)}
            accessibilityRole="button"
            accessibilityLabel="Remove member"
            disabled={removeBusy}
          >
            <Text style={styles.removeText}>Remove member</Text>
          </Pressable>
        </View>
      ) : null}

      <ConfirmDrawer
        visible={confirmingRemove}
        onRequestClose={() => setConfirmingRemove(false)}
        title="Remove member?"
        message={`${subjectName} will leave the group list. Past expenses stay on the ledger.`}
        confirmLabel="Remove member"
        onConfirm={() => void onRemove()}
        testID="member-remove-confirm"
        confirmTestID="member-remove-confirm-ok"
        destructive
        busy={removeBusy}
      />
    </ScrollView>
    </View>
  );
}

function Bucket({
  testID,
  heading,
  lines,
  currency,
  nameOf,
  onOpen,
}: {
  testID: string;
  heading: string;
  lines: BucketLine[];
  currency: string;
  nameOf: (id: string) => string;
  onOpen: (expenseId: string) => void;
}) {
  return (
    <View testID={testID} style={styles.bucket}>
      <Text style={styles.sec}>{heading}</Text>
      {lines.map((line) => {
          const left = bucketLineLabel(line, nameOf);
          return (
            <Pressable
              key={line.expense_id}
              testID="bucket-line"
              style={styles.line}
              onPress={() => onOpen(line.expense_id)}
              accessibilityRole="button"
              accessibilityLabel={left}
            >
              <Text style={styles.lineLeft}>{left}</Text>
              <Text
                style={[
                  styles.lineAmt,
                  line.amount_cents > 0
                    ? styles.amtPos
                    : line.amount_cents < 0
                      ? styles.amtNeg
                      : null,
                ]}
              >
                {formatMoney(line.amount_cents, currency, true)}
              </Text>
            </Pressable>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.bg,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  headActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  closeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  container: {
    padding: 14,
    paddingBottom: 48,
    backgroundColor: colors.bg,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    fontWeight: '600',
    color: colors.ink,
  },
  headerField: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    fontWeight: '600',
    color: colors.ink,
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  editBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIcon: {
    fontSize: 18,
    color: colors.muted,
  },
  invite: {
    marginBottom: 16,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inviteField: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontFamily: 'monospace',
    fontSize: 13,
    color: colors.ink,
  },
  inviteIconBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  bucket: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    minHeight: 44,
  },
  lineLeft: {
    flex: 1,
    fontSize: 14,
    color: colors.muted,
  },
  lineAmt: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: colors.ink,
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  netLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  netAmt: {
    fontFamily: 'monospace',
    fontWeight: '700',
    fontSize: 16,
    color: colors.ink,
  },
  amtPos: {
    color: colors.accent,
  },
  amtNeg: {
    color: colors.warn,
  },
  settle: {
    marginTop: 16,
  },
  settleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  settleText: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
  },
  settleBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settleBtnText: {
    color: colors.accentInk,
    fontSize: 14,
    fontWeight: '600',
  },
  sec: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  err: {
    marginTop: 16,
    color: colors.danger,
    fontSize: 13,
  },
  footer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  remove: {
    borderWidth: 1,
    borderColor: colors.danger,
    padding: 14,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
});
