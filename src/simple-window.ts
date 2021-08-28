import { Component } from './component';
import { simpleTitleBar } from './toolbar-bar';
import { Window, WindowControls, windowPane } from './window-stuff';

export const SimpleWindow = (title: string | Component, content: Component): Window => (c: WindowControls) => {
  const pane = windowPane([
    simpleTitleBar(title, c.handles.middle, c.close),
    content,
  ]);
  return pane;
};
