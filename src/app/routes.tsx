import { createBrowserRouter } from "react-router";
import Root from "./Root";

export const router = createBrowserRouter([
  {
    path: "/*",
    Component: Root,
  },
]);
