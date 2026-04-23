import { View, StyleSheet } from 'react-native'
import type { ViewStyle } from 'react-native'
import { colors, radius } from '@/lib/theme'

interface CardProps {
  children: React.ReactNode
  style?: ViewStyle | ViewStyle[]
  /** Use a tinted indigo-light background instead of white */
  tinted?: boolean
}

export function Card({ children, style, tinted = false }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        tinted && styles.tinted,
        ...(Array.isArray(style) ? style : style ? [style] : []),
      ]}
    >
      {children}
    </View>
  )
}

export default Card

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    // iOS
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    // Android
    elevation: 3,
  },
  tinted: {
    backgroundColor: colors.primaryLight,
  },
})
