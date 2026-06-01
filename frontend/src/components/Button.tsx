import React from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View, ViewStyle, TextStyle } from "react-native";
import { colors, radius } from "@/src/theme";

interface Props {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  testID?: string;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<Props> = ({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  fullWidth = true,
  testID,
  style,
  icon,
}) => {
  const bgMap: Record<string, string> = {
    primary: colors.brand,
    secondary: colors.bg3,
    ghost: "transparent",
    danger: colors.danger,
  };
  const colorMap: Record<string, string> = {
    primary: colors.textInverse,
    secondary: colors.text,
    ghost: colors.brand,
    danger: colors.textInverse,
  };
  const padMap: Record<string, { v: number; h: number; f: number }> = {
    sm: { v: 8, h: 12, f: 13 },
    md: { v: 13, h: 16, f: 15 },
    lg: { v: 16, h: 20, f: 16 },
  };
  const p = padMap[size];
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        {
          backgroundColor: bgMap[variant],
          paddingVertical: p.v,
          paddingHorizontal: p.h,
          borderRadius: radius.md,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          opacity: disabled ? 0.5 : 1,
          width: fullWidth ? "100%" : undefined,
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor: colors.border,
        } as ViewStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colorMap[variant]} size="small" />
      ) : (
        <View style={styles.row}>
          {icon ? <View style={{ marginRight: 8 }}>{icon}</View> : null}
          <Text style={{ color: colorMap[variant], fontWeight: "700", fontSize: p.f } as TextStyle}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
});
