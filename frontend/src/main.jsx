import ReactDOM from "react-dom/client";
import "./index.css";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import Axios from 'axios';
import App from "./components/App.jsx";
import Archives from "./components/Archives.jsx";
import ViewArchive from "./components/ViewArchive.jsx";
import Home from "./components/Home.jsx";

Axios.defaults.withCredentials = true;

const router = createBrowserRouter([
  {
    path: "/GST-knocks",
    element: <App />,
    children: [
      {
        path: "/GST-knocks/archive",
        element: <Archives />
      },
      {
        path: "/GST-knocks/archive/:id",
        element: <ViewArchive />,
      },
      {
        path: "/GST-knocks/home",
        element: <Home />,
      },
      {
        path: "/GST-knocks/",
        element: <Home />,
      }
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <RouterProvider router={router} />
);