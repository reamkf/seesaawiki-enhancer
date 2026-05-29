function setupSeesaawikiColorProvider() {
  const colorTestElement = document.createElement('div');
  colorTestElement.id = 'color-test';
  colorTestElement.style.display = 'none';
  document.body.appendChild(colorTestElement);

  function colorNameToRGB(colorName) {
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

  function hexToRGB(hex) {
    hex = hex.replace(/^#/, '');
    let alpha = 1;

    if (hex.length === 3) {
      hex = hex.split('').map((char) => char + char).join('');
    } else if (hex.length === 8) {
      alpha = parseInt(hex.slice(6, 8), 16) / 255;
      hex = hex.slice(0, 6);
    }

    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    return { red: r / 255, green: g / 255, blue: b / 255, alpha };
  }

  function parseColor(color) {
    if (!color) return null;
    color = color.trim();
    if (color.startsWith('#')) {
      return hexToRGB(color);
    } else {
      return colorNameToRGB(color);
    }
  }

  function rgbaToHex(r, g, b, a) {
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
    provideDocumentColors: function (model) {
      const text = model.getValue();
      const hexRegex = '[0-9A-Fa-f]';
      const colorRepresentationRegex = `#${hexRegex}{8}|#${hexRegex}{6}|#${hexRegex}{3}|[a-zA-Z]+`;
      const colorRegex = new RegExp(
        `(&color\\(|#color\\(|color\\(|bgcolor\\()\\s*(${colorRepresentationRegex})?\\s*(?:,\\s*(${colorRepresentationRegex})\\s*)?\\)`,
        'g'
      );
      let match;
      const colors = [];

      while ((match = colorRegex.exec(text)) !== null) {
        const fullMatch = match[0];
        const prefix = match[1];
        const firstColor = match[2];
        const secondColor = match[3];

        if (prefix === '&color(' || prefix === '#color(') {
          if (firstColor) {
            const firstColorStart = match.index + prefix.length;
            const firstColorEnd = firstColorStart + firstColor.length;
            colors.push({
              range: {
                startLineNumber: model.getPositionAt(firstColorStart).lineNumber,
                startColumn: model.getPositionAt(firstColorStart).column,
                endLineNumber: model.getPositionAt(firstColorEnd).lineNumber,
                endColumn: model.getPositionAt(firstColorEnd).column,
              },
              color: parseColor(firstColor),
            });
          }
          if (secondColor) {
            const secondColorStart = fullMatch.lastIndexOf(secondColor);
            const secondColorEnd = secondColorStart + secondColor.length;
            colors.push({
              range: {
                startLineNumber: model.getPositionAt(match.index + secondColorStart).lineNumber,
                startColumn: model.getPositionAt(match.index + secondColorStart).column,
                endLineNumber: model.getPositionAt(match.index + secondColorEnd).lineNumber,
                endColumn: model.getPositionAt(match.index + secondColorEnd).column,
              },
              color: parseColor(secondColor),
            });
          }
        } else {
          const colorValue = firstColor || secondColor;
          if (colorValue) {
            const colorStart = fullMatch.indexOf(colorValue);
            const colorEnd = colorStart + colorValue.length;
            colors.push({
              range: {
                startLineNumber: model.getPositionAt(match.index + colorStart).lineNumber,
                startColumn: model.getPositionAt(match.index + colorStart).column,
                endLineNumber: model.getPositionAt(match.index + colorEnd).lineNumber,
                endColumn: model.getPositionAt(match.index + colorEnd).column,
              },
              color: parseColor(colorValue),
            });
          }
        }
      }

      return colors;
    },

    provideColorPresentations: function (model, colorInfo) {
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
