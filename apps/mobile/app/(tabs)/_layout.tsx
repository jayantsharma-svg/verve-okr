import { Platform, View } from 'react-native'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors, shadow } from '@/lib/theme'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

function tabIcon(activeName: IoniconsName, inactiveName: IoniconsName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={focused ? activeName : inactiveName} size={23} color={color} />
    </View>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray400,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          // iOS shadow
          ...shadow.md,
          shadowOffset: { width: 0, height: -2 },
          ...(Platform.OS === 'android' && { elevation: 12 }),
          height: Platform.OS === 'ios' ? 82 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: tabIcon('home', 'home-outline'),
        }}
      />
      <Tabs.Screen
        name="okrs"
        options={{
          title: 'OKRs',
          tabBarIcon: tabIcon('flag', 'flag-outline'),
        }}
      />
      <Tabs.Screen
        name="checkin"
        options={{
          title: 'Check-in',
          tabBarIcon: tabIcon('checkmark-circle', 'checkmark-circle-outline'),
        }}
      />
      <Tabs.Screen
        name="appraisals"
        options={{
          title: 'Appraisals',
          tabBarIcon: tabIcon('clipboard', 'clipboard-outline'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: tabIcon('person-circle', 'person-circle-outline'),
        }}
      />
    </Tabs>
  )
}
