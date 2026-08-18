import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  size?: number;
  withWordmark?: boolean;
};

export function LogoV({ size = 48, withWordmark = false }: Props) {
  return (
    <View style={styles.wrap}>
      <Image
        source={require('../../assets/valora-v-logo.png')}
        style={[styles.mark, { width: size, height: size }]}
        resizeMode="contain"
      />
      {withWordmark ? <Text style={styles.wordmark}>VALORA</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  mark: {
    borderRadius: 10
  },
  wordmark: {
    marginTop: 6,
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0
  }
});
