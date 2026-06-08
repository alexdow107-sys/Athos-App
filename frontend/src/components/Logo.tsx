import React from "react";
import { Image, StyleSheet, View, Text } from "react-native";
import { colors } from "@/src/theme";

const LOGO = require("../../assets/images/athos-logo.png");

interface Props {
  size?: number;
  showText?: boolean;
  tint?: string;
}

export const Logo: React.FC<Props> = ({ size = 56, showText = true, tint }) => {
  return (
    <View style={styles.row}>
      <Image source={LOGO} style={{ width: size, height: size, resizeMode: "contain", tintColor: tint }} />
      {showText && (
        <Text style={[styles.text, { color: tint || colors.brand, fontSize: size * 0.7 }]}>Athos</Text>
      )}
    </View>
  );
};

export const LogoMark: React.FC<{ size?: number; tint?: string }> = ({ size = 32, tint }) => (
  <Image source={LOGO} style={{ width: size, height: size, resizeMode: "contain", tintColor: tint }} />
);

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  text: { fontWeight: "900", letterSpacing: -1.5, marginLeft: 8 },
});
