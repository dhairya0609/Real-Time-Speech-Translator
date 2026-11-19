import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./components/App";

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} } as any));
  (global as any).fetch = jest.fn(() => new Promise(() => {}));
  (global as any).ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  HTMLCanvasElement.prototype.getContext = () => null;
  Element.prototype.scrollTo = () => {};
});

test("offers voice and typed translation", () => {
  render(<App />);
  expect(screen.getByRole("button", { name: /start listening/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/type to translate/i)).toBeInTheDocument();
  expect(screen.getByText(/speak naturally/i)).toBeInTheDocument();
});
