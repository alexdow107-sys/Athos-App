import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { colors } from "@/src/theme";
import { initials } from "@/src/utils/format";

interface Props {
  uri?: string | null;
  name?: string;
  size?: number;
  testID?: string;
}

export const Avatar: React.FC<Props> = ({ uri, name, size = 40, testID }) => {
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };
  if (uri) {
    return (
      <Image
        testID={testID}
        source={{ uri }}
        style={[styles.img, containerStyle]}
      />
    );
  }
  return (
    <View testID={testID} style={[styles.placeholder, containerStyle]}>
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initials(name || "?")}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  img: {
    backgroundColor: colors.bg3,
  },
  placeholder: {
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: colors.brand,
    fontWeight: "700",
  },
});
