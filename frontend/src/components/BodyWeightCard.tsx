import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, Pressable,
  ActivityIndicator, Platform, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";

interface WeighIn { weigh_in_id: string; date: string; weight: number }

const CHART_H = 110;

/** Line chart drawn with plain Views (no SVG dependency): dots at each
 * weigh-in, connected by thin segments centered on each pair's midpoint. */
function TrendChart({ points, unit }: { points: WeighIn[]; unit: string }) {
  const [width, setWidth] = useState(0);
  const data = points.slice(-30);
  if (data.length < 2) return null;

  const weights = data.map((p) => p.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const pad = Math.max((max - min) * 0.15, 0.5);
  const lo = min - pad, hi = max + pad;

  const xy = (i: number, w: number) => ({
    x: data.length === 1 ? width / 2 : (i / (data.length - 1)) * (width - 16) + 8,
    y: CHART_H - ((w - lo) / (hi - lo)) * CHART_H,
  });

  return (
    <View style={{ marginTop: spacing.sm }}>
      <View style={styles.chartArea} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && data.map((p, i) => {
          const a = xy(i, p.weight);
          const elems = [
            <View key={`d${i}`} style={[styles.dot, { left: a.x - 3, top: a.y - 3 }]} />,
          ];
          if (i < data.length - 1) {
            const b = xy(i + 1, data[i + 1].weight);
            const dx = b.x - a.x, dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            elems.push(
              <View
                key={`s${i}`}
                style={[styles.segment, {
                  width: dist,
                  left: (a.x + b.x) / 2 - dist / 2,
                  top: (a.y + b.y) / 2 - 1,
                  transform: [{ rotateZ: `${angle}rad` }],
                }]}
              />,
            );
          }
          return elems;
        })}
      </View>
      <View style={styles.chartAxis}>
        <Text style={styles.axisLabel}>{fmtDateShort(data[0].date)}</Text>
        <Text style={styles.axisLabel}>{fmtDateShort(data[data.length - 1].date)}</Text>
      </View>
    </View>
  );
}

function fmtDateShort(d: string) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function BodyWeightCard({ weightUnit, refreshKey }: { weightUnit: string; refreshKey?: number }) {
  const [items, setItems] = useState<WeighIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ weigh_ins: WeighIn[] }>("/weigh-ins?limit=90");
      setItems(r.weigh_ins || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const latest = items.length ? items[items.length - 1] : null;
  const first = items.length ? items[0] : null;
  const change = latest && first && items.length > 1 ? latest.weight - first.weight : null;

  const onSave = async () => {
    const w = parseFloat(input.replace(",", "."));
    if (!w || w <= 0) {
      if (Platform.OS === "web") window.alert("Enter a valid weight");
      else Alert.alert("Enter a valid weight");
      return;
    }
    setSaving(true);
    try {
      // Log against the client's local date so late-night entries land on the right day
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      await api("/weigh-ins", { method: "POST", body: JSON.stringify({ weight: w, date }) });
      setInput("");
      setLogOpen(false);
      await load();
    } catch (e: any) {
      if (Platform.OS === "web") window.alert("Failed: " + (e?.message || ""));
      else Alert.alert("Failed", e?.message || "Try again");
    } finally { setSaving(false); }
  };

  return (
    <View style={styles.card} testID="bodyweight-card">
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          {latest ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
                <Text style={styles.weightVal}>{latest.weight}</Text>
                <Text style={styles.weightUnit}>{weightUnit}</Text>
                {change != null && change !== 0 && (
                  <Text style={[styles.changeText, { color: change < 0 ? colors.success : colors.textSecondary }]}>
                    {change > 0 ? "+" : ""}{Math.round(change * 10) / 10} {weightUnit}
                  </Text>
                )}
              </View>
              <Text style={styles.weightMeta}>last weigh-in {fmtDateShort(latest.date)}</Text>
            </>
          ) : loading ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <>
              <Text style={styles.emptyTitle}>Track your body weight</Text>
              <Text style={styles.weightMeta}>Log weigh-ins to see your trend over time</Text>
            </>
          )}
        </View>
        <TouchableOpacity testID="log-weight-btn" style={styles.logBtn} onPress={() => setLogOpen(true)} activeOpacity={0.8}>
          <Ionicons name="add" size={16} color={colors.textInverse} />
          <Text style={styles.logBtnText}>Log</Text>
        </TouchableOpacity>
      </View>

      <TrendChart points={items} unit={weightUnit} />

      {/* Log weigh-in modal */}
      <Modal visible={logOpen} transparent animationType="fade" onRequestClose={() => setLogOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLogOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{"Today's weight"}</Text>
            <View style={styles.inputRow}>
              <TextInput
                testID="weight-input"
                value={input}
                onChangeText={setInput}
                placeholder={latest ? String(latest.weight) : "0"}
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                style={styles.input}
                autoFocus
              />
              <Text style={styles.inputUnit}>{weightUnit}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.md }}>
              <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnGhost]} onPress={() => setLogOpen(false)}>
                <Text style={styles.sheetBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="weight-save-btn" style={[styles.sheetBtn, styles.sheetBtnPrimary]} onPress={onSave} disabled={saving}>
                <Text style={styles.sheetBtnPrimaryText}>{saving ? "..." : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.bg2, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md,
  },
  top: { flexDirection: "row", alignItems: "center" },
  weightVal: { fontSize: 28, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  weightUnit: { fontSize: 14, fontWeight: "700", color: colors.textSecondary, marginBottom: 4 },
  changeText: { fontSize: 12, fontWeight: "800", marginBottom: 5, marginLeft: 4 },
  weightMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  logBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.brand, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full,
  },
  logBtnText: { color: colors.textInverse, fontWeight: "800", fontSize: 13 },
  chartArea: { height: CHART_H, position: "relative" },
  dot: { position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand },
  segment: { position: "absolute", height: 2, borderRadius: 1, backgroundColor: colors.brand, opacity: 0.7 },
  chartAxis: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  axisLabel: { fontSize: 10, color: colors.textMuted, fontWeight: "600" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  sheet: { width: "100%", maxWidth: 340, backgroundColor: colors.bg2, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  sheetTitle: { fontSize: 16, fontWeight: "900", color: colors.text, marginBottom: spacing.md },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 22, fontWeight: "800",
    color: colors.text, backgroundColor: colors.bg, textAlign: "center",
  },
  inputUnit: { fontSize: 15, fontWeight: "800", color: colors.textSecondary },
  sheetBtn: { flex: 1, paddingVertical: 12, borderRadius: radius.md, alignItems: "center" },
  sheetBtnPrimary: { backgroundColor: colors.brand },
  sheetBtnPrimaryText: { color: colors.textInverse, fontWeight: "800", fontSize: 14 },
  sheetBtnGhost: { backgroundColor: colors.bg3 },
  sheetBtnGhostText: { color: colors.text, fontWeight: "800", fontSize: 14 },
});
