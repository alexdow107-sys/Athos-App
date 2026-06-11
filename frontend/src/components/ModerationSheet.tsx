import React, { useState } from "react";
import {
  View, Text, StyleSheet, Modal, Pressable, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";

const REASONS = [
  { key: "spam", label: "Spam or scam" },
  { key: "harassment", label: "Harassment or bullying" },
  { key: "inappropriate", label: "Inappropriate or explicit content" },
  { key: "hate", label: "Hate speech or symbols" },
  { key: "violence", label: "Violence or dangerous acts" },
  { key: "other", label: "Something else" },
];

export type ModTarget =
  | { kind: "post"; postId: string; userId: string; username?: string; displayName?: string }
  | { kind: "user"; userId: string; username?: string; displayName?: string };

/**
 * Report / block action sheet for user-generated content (App Store Guideline 1.2).
 * Custom modal so it works identically on web and native.
 */
export function ModerationSheet({
  visible, target, onClose, onBlocked,
}: {
  visible: boolean;
  target: ModTarget | null;
  onClose: () => void;
  onBlocked?: (userId: string) => void;
}) {
  const [step, setStep] = useState<"menu" | "report" | "block">("menu");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const close = () => { setStep("menu"); setBusy(false); setDone(null); onClose(); };

  if (!target) return null;
  const who = target.username ? "@" + target.username : (target.displayName || "this user");

  const submitReport = async (reasonKey: string) => {
    setBusy(true);
    try {
      await api("/reports", {
        method: "POST",
        body: JSON.stringify({
          target_type: target.kind,
          target_id: target.kind === "post" ? target.postId : target.userId,
          reason: reasonKey,
        }),
      });
      setDone("Thanks — your report was submitted to our team for review.");
    } catch {
      setDone("Couldn't submit the report. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const doBlock = async () => {
    setBusy(true);
    try {
      await api(`/users/${target.userId}/block`, { method: "POST" });
      onBlocked?.(target.userId);
      setDone(`${who} has been blocked.`);
    } catch {
      setDone("Couldn't block this user. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          {done ? (
            <View style={styles.center}>
              <Ionicons name="checkmark-circle" size={42} color={colors.brand} />
              <Text style={styles.doneText}>{done}</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={close} activeOpacity={0.85}>
                <Text style={styles.primaryBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : busy ? (
            <ActivityIndicator color={colors.brand} style={{ paddingVertical: 36 }} />
          ) : step === "menu" ? (
            <>
              <Text style={styles.title}>{target.kind === "post" ? "Post options" : who}</Text>
              <Row icon="flag-outline" label={`Report ${target.kind === "post" ? "post" : "account"}`}
                color={colors.text} onPress={() => setStep("report")} testID="mod-report" />
              <Row icon="ban-outline" label={`Block ${who}`}
                color={colors.danger} onPress={() => setStep("block")} testID="mod-block" />
              <Row icon="close" label="Cancel" color={colors.textMuted} onPress={close} />
            </>
          ) : step === "report" ? (
            <>
              <Text style={styles.title}>Why are you reporting this?</Text>
              {REASONS.map((r) => (
                <Row key={r.key} icon="chevron-forward" iconRight label={r.label}
                  color={colors.text} onPress={() => submitReport(r.key)} testID={`reason-${r.key}`} />
              ))}
            </>
          ) : (
            <>
              <Text style={styles.title}>Block {who}?</Text>
              <Text style={styles.desc}>
                {"They won't be able to message you or see your posts, and you won't see theirs. They won't be notified."}
              </Text>
              <TouchableOpacity style={styles.dangerBtn} onPress={doBlock} activeOpacity={0.85} testID="confirm-block">
                <Text style={styles.dangerBtnText}>Block</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setStep("menu")} activeOpacity={0.7}>
                <Text style={styles.ghostBtnText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({ icon, label, color, onPress, iconRight, testID }: {
  icon: any; label: string; color: string; onPress: () => void; iconRight?: boolean; testID?: string;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7} testID={testID}>
      {!iconRight && <Ionicons name={icon} size={20} color={color} style={{ width: 28 }} />}
      <Text style={[styles.rowLabel, { color }]}>{label}</Text>
      {iconRight && <><View style={{ flex: 1 }} /><Ionicons name={icon} size={18} color={colors.textMuted} /></>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bg2, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: spacing.lg, paddingBottom: spacing.xl,
    borderTopWidth: 1, borderColor: colors.border,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md },
  title: { color: colors.text, fontSize: 16, fontWeight: "900", marginBottom: spacing.sm },
  desc: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  rowLabel: { fontSize: 15, fontWeight: "600" },
  center: { alignItems: "center", paddingVertical: spacing.lg, gap: 12 },
  doneText: { color: colors.text, fontSize: 14, textAlign: "center", lineHeight: 20, paddingHorizontal: 10 },
  primaryBtn: { marginTop: 8, backgroundColor: colors.brand, borderRadius: radius.full, paddingHorizontal: 36, paddingVertical: 12 },
  primaryBtnText: { color: colors.textInverse, fontWeight: "800", fontSize: 15 },
  dangerBtn: { backgroundColor: colors.danger, borderRadius: radius.md, paddingVertical: 13, alignItems: "center" },
  dangerBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  ghostBtn: { paddingVertical: 13, alignItems: "center", marginTop: 4 },
  ghostBtnText: { color: colors.textSecondary, fontWeight: "700", fontSize: 14 },
});
