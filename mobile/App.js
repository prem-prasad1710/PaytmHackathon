import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import HomeScreen from "./src/screens/HomeScreen";
import AnalyzeScreen from "./src/screens/AnalyzeScreen";
import ConfirmPayScreen from "./src/screens/ConfirmPayScreen";
import SuccessScreen from "./src/screens/SuccessScreen";
import VerifyScreen from "./src/screens/VerifyScreen";
import BlockedScreen from "./src/screens/BlockedScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import ComplaintSentScreen from "./src/screens/ComplaintSentScreen";
import { colors } from "./src/theme";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.navy },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Scam Shield" }} />
        <Stack.Screen name="Analyze" component={AnalyzeScreen} options={{ title: "Check" }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ title: "History" }} />
        <Stack.Screen
          name="ComplaintSent"
          component={ComplaintSentScreen}
          options={{ title: "Complaint Sent" }}
        />
        <Stack.Screen
          name="ConfirmPay"
          component={ConfirmPayScreen}
          options={{ title: "Confirm Pay" }}
        />
        <Stack.Screen
          name="Success"
          component={SuccessScreen}
          options={{ title: "Success", headerBackVisible: false }}
        />
        <Stack.Screen name="Verify" component={VerifyScreen} options={{ title: "Verify" }} />
        <Stack.Screen name="Blocked" component={BlockedScreen} options={{ title: "Blocked" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
