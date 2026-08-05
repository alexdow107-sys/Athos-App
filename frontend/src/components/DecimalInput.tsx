import React, { useEffect, useState } from "react";
import { TextInput, TextStyle, StyleProp } from "react-native";
import { colors } from "@/src/theme";

/**
 * Numeric input that lets you type decimals like "250.5" without the trailing
 * "." being erased mid-entry. Keeps its own text state and only reports the
 * parsed number up, so a controlled numeric value can't fight your typing.
 */
export function DecimalInput({
  value,
  onChange,
  placeholder,
  style,
  testID,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
}) {
  const [text, setText] = useState(value ? String(value) : "");

  // Re-sync only when the external value changes to something our text doesn't
  // already represent (e.g. set reset, loaded from history) — never mid-typing.
  useEffect(() => {
    const parsed = parseFloat(text);
    const current = isNaN(parsed) ? 0 : parsed;
    if (value !== current) setText(value ? String(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handle = (t: string) => {
    // Allow digits and a single decimal point.
    let clean = t.replace(/[^0-9.]/g, "");
    const parts = clean.split(".");
    if (parts.length > 2) clean = parts[0] + "." + parts.slice(1).join("");
    setText(clean);
    const n = parseFloat(clean);
    onChange(isNaN(n) ? 0 : n);
  };

  return (
    <TextInput
      testID={testID}
      value={text}
      onChangeText={handle}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      keyboardType="decimal-pad"
      style={style}
    />
  );
}
