import { TouchableOpacity, StyleSheet, ViewStyle, useColorScheme, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

interface FABProps {
  onPress?: () => void;
  icon?: any;
  label?: string;
  style?: ViewStyle;
}

export default function FAB({ onPress, icon, label, style }: FABProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  
  const IconComponent = icon;

  return (
    <TouchableOpacity 
      style={[
        styles.fab, 
        { backgroundColor: theme.tint }, 
        label ? styles.extendedFab : styles.circularFab,
        style
      ]} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        {typeof icon === 'function' || typeof icon === 'object' ? (
           <IconComponent size={label ? 20 : 28} color="#FFF" />
        ) : (
           <Ionicons name={icon || 'add'} size={label ? 20 : 28} color="#FFF" />
        )}
        {label && (
          <Text style={styles.label}>{label}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    zIndex: 50,
  },
  circularFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  extendedFab: {
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 26,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
