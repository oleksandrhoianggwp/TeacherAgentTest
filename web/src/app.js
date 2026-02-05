import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Navigate, Route, Routes } from "react-router-dom";
import DemoRequestPage from "./pages/DemoRequestPage";
import DemoSessionPage from "./pages/DemoSessionPage";
export default function App() {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/demo", replace: true }) }), _jsx(Route, { path: "/demo", element: _jsx(DemoRequestPage, {}) }), _jsx(Route, { path: "/demo/:token", element: _jsx(DemoSessionPage, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/demo", replace: true }) })] }));
}
