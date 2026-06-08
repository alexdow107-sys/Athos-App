import React, { useState } from "react";
import { Platform, TouchableOpacity, Text, View, StyleSheet } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { colors, radius, spacing } from "@/src/theme";

interface Props {
  value: Date | null;
  onChange: (d: Date) => void;
  placeholder?: string;
  testID?: string;
  maximumDate?: Date;
  minimumDate?: Date;
}

/**
 * Cross-platform date picker.
 *  - Web: native HTML5 <input type="date">
 *  - iOS: spinner inside a popover
 *  - Android: native modal
 */
export const DatePickerField: React.FC<Props> = ({ value, onChange, placeholder, testID, maximumDate, minimumDate }) => {
  const [showNative, setShowNative] = useState(false);

  if (Platform.OS === "web") {
    const dateStr = value ? value.toISOString().slice(0, 10) : "";
    const min = minimumDate ? minimumDate.toISOString().slice(0, 10) : undefined;
    const max = maximumDate ? maximumDate.toISOString().slice(0, 10) : undefined;
    return (
      // @ts-expect-error using DOM input on web
      <input
        type="date"
        value={dateStr}
        min={min}
        max={max}
        onChange={(e: any) => {
          const v = e.target.value;
          if (v) onChange(new Date(v));
        }}
        style={{
          width: "100%",
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          padding: 12,
          fontSize: 16,
          color: colors.text,
          backgroundColor: colors.bg,
          boxSizing: "border-box",
          fontFamily: "inherit",
          height: 46,
        }}
        data-testid={testID}
      />
    );
  }

  return (
    <View>
      <TouchableOpacity
        testID={testID}
        onPress={() => setShowNative(true)}
        style={styles.input}
        activeOpacity={0.7}
      >
        <Text style={{ color: value ? colors.text : colors.textMuted, fontSize: 16 }}>
          {value ? value.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : placeholder || "Tap to choose date"}
        </Text>
      </TouchableOpacity>
      {showNative && (
        <DateTimePicker
          value={value || new Date(2000, 0, 1)}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          onChange={(_, d) => {
            if (Platform.OS !== "ios") setShowNative(false);
            if (d) onChange(d);
          }}
        />
      )}
      {Platform.OS === "ios" && showNative && (
        <TouchableOpacity onPress={() => setShowNative(false)} style={styles.done}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 13, backgroundColor: colors.bg,
    justifyContent: "center", minHeight: 46,
  },
  done: { alignSelf: "flex-end", paddingHorizontal: 16, paddingVertical: 8 },
  doneText: { color: colors.brand, fontWeight: "800" },
});
