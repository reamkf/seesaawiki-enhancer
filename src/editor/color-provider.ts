import type * as monacoNs from 'monaco-editor';

type MonacoNamespace = typeof monacoNs;

interface RGBA {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

export function setupSeesaawikiColorProvider(monaco: MonacoNamespace): void {
  const colorTestElement = document.createElement('div');
  colorTestElement.id = 'color-test';
  colorTestElement.style.display = 'none';
  document.body.appendChild(colorTestElement);

  function colorNameToRGB(colorName: string): RGBA | null {
    colorTestElement.style.color = colorName;
    const color = window.getComputedStyle(colorTestElement).getPropertyValue('color');

    const match = color.match(/\d+/g);
    if (match) {
      const [r, g, b] = match.map(Number);
      const a = colorName === 'transparent' ? 0 : 1;
      return { red: r / 255, green: g / 255, blue: b / 255, alpha: a };
    }
    return null;
  }

  function hexToRGB(hex: string): RGBA {
    let normalized = hex.replace(/^#/, '');
    let alpha = 1;

    if (normalized.length === 3) {
      normalized = normalized.split('').map((char) => char + char).join('');
    } else if (normalized.length === 8) {
      alpha = parseInt(normalized.slice(6, 8), 16) / 255;
      normalized = normalized.slice(0, 6);
    }

    const bigint = parseInt(normalized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    return { red: r / 255, green: g / 255, blue: b / 255, alpha };
  }

  function parseColor(color: string | null | undefined): RGBA | null {
    if (!color) return null;
    const trimmed = color.trim();
    if (trimmed.startsWith('#')) {
      return hexToRGB(trimmed);
    } else {
      return colorNameToRGB(trimmed);
    }
  }

  function rgbaToHex(r: number, g: number, b: number, a: number): string {
    r = Math.round(r * 255);
    g = Math.round(g * 255);
    b = Math.round(b * 255);
    a = Math.round(a * 255);
    return (
      '#' +
      ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1) +
      (a === 255 ? '' : a.toString(16).padStart(2, '0'))
    );
  }

  monaco.languages.registerColorProvider('seesaawiki', {
    provideDocumentColors(model) {
      const text = model.getValue();
      const hexRegex = '[0-9A-Fa-f]';
      const colorRepresentationRegex = `#${hexRegex}{8}|#${hexRegex}{6}|#${hexRegex}{3}|[a-zA-Z]+`;
      const colorRegex = new RegExp(
        `(&color\\(|#color\\(|color\\(|bgcolor\\()\\s*(${colorRepresentationRegex})?\\s*(?:,\\s*(${colorRepresentationRegex})\\s*)?\\)`,
        'g'
      );
      let match: RegExpExecArray | null;
      const colors: monacoNs.languages.IColorInformation[] = [];

      while ((match = colorRegex.exec(text)) !== null) {
        const fullMatch = match[0];
        const prefix = match[1];
        const firstColor = match[2];
        const secondColor = match[3];

        if (prefix === '&color(' || prefix === '#color(') {
          if (firstColor) {
            const firstColorStart = match.index + prefix.length;
            const firstColorEnd = firstColorStart + firstColor.length;
            const parsed = parseColor(firstColor);
            if (parsed) {
              colors.push({
                range: {
                  startLineNumber: model.getPositionAt(firstColorStart).lineNumber,
                  startColumn: model.getPositionAt(firstColorStart).column,
                  endLineNumber: model.getPositionAt(firstColorEnd).lineNumber,
                  endColumn: model.getPositionAt(firstColorEnd).column,
                },
                color: parsed,
              });
            }
          }
          if (secondColor) {
            const secondColorStart = fullMatch.lastIndexOf(secondColor);
            const secondColorEnd = secondColorStart + secondColor.length;
            const parsed = parseColor(secondColor);
            if (parsed) {
              colors.push({
                range: {
                  startLineNumber: model.getPositionAt(match.index + secondColorStart).lineNumber,
                  startColumn: model.getPositionAt(match.index + secondColorStart).column,
                  endLineNumber: model.getPositionAt(match.index + secondColorEnd).lineNumber,
                  endColumn: model.getPositionAt(match.index + secondColorEnd).column,
                },
                color: parsed,
              });
            }
          }
        } else {
          const colorValue = firstColor || secondColor;
          if (colorValue) {
            const colorStart = fullMatch.indexOf(colorValue);
            const colorEnd = colorStart + colorValue.length;
            const parsed = parseColor(colorValue);
            if (parsed) {
              colors.push({
                range: {
                  startLineNumber: model.getPositionAt(match.index + colorStart).lineNumber,
                  startColumn: model.getPositionAt(match.index + colorStart).column,
                  endLineNumber: model.getPositionAt(match.index + colorEnd).lineNumber,
                  endColumn: model.getPositionAt(match.index + colorEnd).column,
                },
                color: parsed,
              });
            }
          }
        }
      }

      return colors;
    },

    provideColorPresentations(_model, colorInfo) {
      const newColor = rgbaToHex(
        colorInfo.color.red,
        colorInfo.color.green,
        colorInfo.color.blue,
        colorInfo.color.alpha
      );

      return [{ label: newColor }];
    },
  });
}
