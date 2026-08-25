import { getPalette, Radius, Shadow } from '@/constants/design-tokens';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { StyleSheet, View, type ViewProps } from 'react-native';

type SurfaceProps = ViewProps & {
  raised?: boolean;
  inset?: boolean;
};

/** A themed card surface with consistent radius, border and soft shadow. */
export function Surface({ style, raised = false, inset = false, ...rest }: SurfaceProps) {
  const isDark = useColorScheme() === 'dark';
  const p = getPalette(isDark);

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: inset ? p.surfaceAlt : p.surface,
          borderColor: p.border,
        },
        raised && (Shadow.raised as object),
        !raised && (Shadow.card as object),
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    borderWidth: 0.5,
  },
});
