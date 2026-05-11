import { RouterProvider } from "react-router";
import { router } from "./routes";
import PWANotificationManager from "./components/PWANotificationManager";

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <PWANotificationManager />
    </>
  );
}
