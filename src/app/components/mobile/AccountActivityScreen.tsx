import { MobileProfileScreen } from "./MobileProfileScreen";

interface AccountActivityScreenProps {
  onLogout: () => void;
}

export function AccountActivityScreen({ onLogout }: AccountActivityScreenProps) {
  // This screen is simply a wrapper around MobileProfileScreen
  // which already contains profile info + booking history in one view
  return <MobileProfileScreen onLogout={onLogout} />;
}
