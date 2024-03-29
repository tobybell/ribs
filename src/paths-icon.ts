import { Component, mount } from './component';
import { Handler } from './stream-stuff';
import { cleanup, Temporary } from './temporary-stuff';

export type IconPath = [number, string];
export type IconDescriptor = [number, number, IconPath[]];
export type Icon = (x?: {
  size?: number,
  color?: string,
  onClick?: Handler<MouseEvent>,
  style?: any,
  effects?: Temporary<SVGSVGElement>[],
}) => Component;

export function pathsIcon([width, height, paths]: IconDescriptor, defaultColor = 'white'): Icon {
  return ({ size = height, color = defaultColor, onClick, style, effects = [] } = {}) => {
    const viewBox = `0 0 ${width * 2} ${height * 2}`;
    return r => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttributeNS(null, 'fill', color);
      svg.setAttributeNS(null, 'width', `${size / height * width}`);
      svg.setAttributeNS(null, 'height', `${size}`);
      svg.setAttributeNS(null, 'viewBox', viewBox);
      svg.setAttributeNS(null, 'fill-rule', 'evenodd');
      svg.style.display = 'block';
      Object.keys(style || {}).forEach(k => {
        svg.style.setProperty(k, style[k]);
      });
      if (onClick) svg.addEventListener('click', onClick);
      paths.forEach(([o, p]) => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttributeNS(null, 'd', p);
        path.setAttributeNS(null, 'fill-opacity', `${o}`);
        svg.appendChild(path);
      });
      return cleanup(
        ...effects.map(f => f(svg)),
        r(svg),
      );
    }
  };
}
