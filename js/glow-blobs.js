(function () {
  const MAX_BLOBS = 24;

  const vertexSrc = `
    attribute vec2 position;
    void main() { gl_Position = vec4(position, 0.0, 1.0); }
  `;

  const fragmentSrc = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform int u_count;
    uniform vec2 u_centers[${MAX_BLOBS}];
    uniform vec3 u_colors[${MAX_BLOBS}];
    uniform float u_radii[${MAX_BLOBS}];
    uniform float u_opacities[${MAX_BLOBS}];
    uniform vec3 u_bgColor;

    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution.xy;
      vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
      vec3 color = u_bgColor;

      for (int i = 0; i < ${MAX_BLOBS}; i++) {
        if (i >= u_count) break;
        vec2 center = u_centers[i];
        float dist = length((uv - center) * aspect);
        float radius = u_radii[i] + sin(u_time * 0.25 + float(i) * 2.0) * u_radii[i] * 0.04;
        float sigma = radius * 0.62;
        float glow = exp(-(dist * dist) / (2.0 * sigma * sigma));
        glow *= u_opacities[i];
        color = 1.0 - (1.0 - color) * (1.0 - glow * u_colors[i]);
      }

      // Статичний dither проти banding (без u_time — інакше «полоси» мерехтять)
      float dither = (random(gl_FragCoord.xy) - 0.5) / 255.0;
      color += vec3(dither);
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function hexToVec3(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function colorToVec3(raw) {
    const value = raw.trim();
    if (!value) return hexToVec3('#0D0D12');

    if (value.startsWith('#')) {
      return hexToVec3(value);
    }

    const rgb = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (rgb) {
      return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255];
    }

    return hexToVec3('#0D0D12');
  }

  function readBgColor(groupEl) {
    const custom = getComputedStyle(groupEl).getPropertyValue('--glow-bg').trim();
    if (custom) {
      return colorToVec3(custom);
    }

    return colorToVec3(getComputedStyle(document.body).backgroundColor);
  }

  function readBlobFromCSS(el) {
    const cs = getComputedStyle(el);
    const num = (name, fallback) => {
      const v = parseFloat(cs.getPropertyValue(name));
      return Number.isNaN(v) ? fallback : v;
    };
    const raw = (name) => cs.getPropertyValue(name).trim();
    const data = el.dataset;
    const colorRaw = data.glowColor || raw('--glow-color') || '#7c3aed';
    const xRaw = data.glowX || raw('--glow-x');
    const yRaw = data.glowY || raw('--glow-y');
    const sizeRaw = data.glowSize || raw('--glow-size');
    const opacityRaw = data.glowOpacity || raw('--glow-opacity');
    const xIsPx = /px$/i.test(xRaw);
    const yIsPx = /px$/i.test(yRaw);
    const xIsPercent = /%$/.test(xRaw);
    const yIsPercent = /%$/.test(yRaw);
    const sizeIsPx = /px$/i.test(sizeRaw);
    const xValue = parseFloat(xRaw);
    const yValue = parseFloat(yRaw);
    const sizeValue = parseFloat(sizeRaw);

    return {
      color: hexToVec3(colorRaw),
      x: Number.isNaN(xValue) ? 0 : xValue,
      y: Number.isNaN(yValue) ? 0 : yValue,
      xIsPx,
      yIsPx,
      xIsPercent,
      yIsPercent,
      size: Number.isNaN(sizeValue) ? 0.3 : sizeValue,
      sizeIsPx,
      opacity: parseFloat(opacityRaw) || num('--glow-opacity', 1.0),
    };
  }

  function resolveOffset(value, isPx, isPercent, base) {
    if (isPx) return value;
    if (isPercent) return (value / 100) * base;
    return value * base;
  }

  function getLayoutViewport() {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  function getOffsetWithinGroup(el, groupEl) {
    let top = 0;
    let left = 0;
    let node = el;

    while (node && node !== groupEl) {
      top += node.offsetTop;
      left += node.offsetLeft;
      node = node.offsetParent;
    }

    if (node === groupEl) {
      return { top, left };
    }

    const groupRect = groupEl.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    return {
      top: elRect.top - groupRect.top,
      left: elRect.left - groupRect.left,
    };
  }

  function measureContentBottom(groupEl) {
    let bottom = 0;

    groupEl.querySelectorAll('section, [class*="section--"]').forEach((sectionEl) => {
      bottom = Math.max(bottom, sectionEl.offsetTop + sectionEl.offsetHeight);
    });

    return bottom;
  }

  function measureAnchorContentBottom(groupEl, anchors) {
    let bottom = 0;

    anchors.forEach((anchorEl) => {
      const sectionEl = getGlowTargetSection(anchorEl, groupEl);
      if (sectionEl) {
        bottom = Math.max(bottom, sectionEl.offsetTop + sectionEl.offsetHeight);
      }
    });

    return bottom || measureContentBottom(groupEl);
  }

  function getBleedPx(groupEl) {
    const { height: viewportH } = getLayoutViewport();
    const bleedRaw = getComputedStyle(groupEl).getPropertyValue('--glow-canvas-bleed').trim() || '420px';
    return parseCssLength(bleedRaw, viewportH) ?? 420;
  }

  function parseCssLength(raw, base) {
    const value = parseFloat(raw);
    if (Number.isNaN(value)) return null;
    if (/vh$/i.test(raw)) return (value / 100) * base;
    if (/vw$/i.test(raw)) return (value / 100) * window.innerWidth;
    return value;
  }

  function getGlowTargetSection(anchorEl, groupEl) {
    const targetSel = anchorEl.dataset.glowTarget;
    if (targetSel) {
      return groupEl.querySelector(targetSel) || document.querySelector(targetSel);
    }

    let next = anchorEl.nextElementSibling;
    while (next) {
      if (next.matches('section, [class*="section--"]')) {
        return next;
      }
      next = next.nextElementSibling;
    }

    return null;
  }

  function positionAnchor(anchorEl, groupEl, sectionEl) {
    const cs = getComputedStyle(anchorEl);
    const { height: viewportH } = getLayoutViewport();
    const extraTop = parseCssLength(cs.getPropertyValue('--glow-anchor-top').trim(), viewportH) ?? 0;
    const extraLeft = parseCssLength(cs.getPropertyValue('--glow-anchor-left').trim(), viewportH) ?? 0;

    if (!sectionEl) {
      return;
    }

    const { top: sectionTop, left: sectionLeft } = getOffsetWithinGroup(sectionEl, groupEl);
    anchorEl.style.top = `${sectionTop + extraTop}px`;
    anchorEl.style.left = `${sectionLeft + extraLeft}px`;
  }

  function positionAllAnchors(groupEl, anchors) {
    anchors.forEach((anchorEl) => {
      positionAnchor(anchorEl, groupEl, getGlowTargetSection(anchorEl, groupEl));
    });
  }

  function getGroupCanvasSize(groupEl, layoutState, anchors) {
    const { height: viewportH } = getLayoutViewport();
    const width = Math.max(1, groupEl.clientWidth);
    const cs = getComputedStyle(groupEl);

    const customHeight = cs.getPropertyValue('--glow-canvas-height').trim();
    if (customHeight) {
      const parsed = parseCssLength(customHeight, viewportH);
      if (parsed) {
        layoutState.width = width;
        layoutState.height = Math.max(1, parsed);
        return { width, height: layoutState.height };
      }
    }

    const measured = Math.max(1, measureAnchorContentBottom(groupEl, anchors) + getBleedPx(groupEl));

    // Висота canvas — тільки при зміні ширини (breakpoint), не при toolbar
    if (!layoutState.height || width !== layoutState.width) {
      layoutState.width = width;
      layoutState.height = measured;
    }

    return {
      width,
      height: layoutState.height,
    };
  }

  function createGlContext(canvas) {
    const gl = canvas.getContext('webgl');
    if (!gl) return null;

    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
      return s;
    }

    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSrc));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSrc));
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    return {
      gl,
      resLoc: gl.getUniformLocation(program, 'u_resolution'),
      timeLoc: gl.getUniformLocation(program, 'u_time'),
      countLoc: gl.getUniformLocation(program, 'u_count'),
      centersLoc: gl.getUniformLocation(program, 'u_centers'),
      colorsLoc: gl.getUniformLocation(program, 'u_colors'),
      radiiLoc: gl.getUniformLocation(program, 'u_radii'),
      opacitiesLoc: gl.getUniformLocation(program, 'u_opacities'),
      bgLoc: gl.getUniformLocation(program, 'u_bgColor'),
    };
  }

  function initGroup(groupEl) {
    const anchors = [...groupEl.querySelectorAll('.glow-anchor')];
    const blobEls = anchors.length
      ? anchors.flatMap((anchor) => [...anchor.querySelectorAll('.glow-blob')])
      : [...groupEl.querySelectorAll('.glow-blob')];

    const activeBlobs = blobEls.slice(0, MAX_BLOBS);
    if (!activeBlobs.length) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'glow-group__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    groupEl.insertBefore(canvas, groupEl.firstChild);

    const ctx = createGlContext(canvas);
    if (!ctx) return;

    const { gl, resLoc, timeLoc, countLoc, centersLoc, colorsLoc, radiiLoc, opacitiesLoc, bgLoc } = ctx;
    const centers = new Float32Array(MAX_BLOBS * 2);
    const colors = new Float32Array(MAX_BLOBS * 3);
    const radii = new Float32Array(MAX_BLOBS);
    const opacities = new Float32Array(MAX_BLOBS);
    let bgColor = readBgColor(groupEl);
    const layoutState = { width: 0, height: 0 };

    function refreshBlobsFromCSS(cssWidth, cssHeight) {
      activeBlobs.forEach((el, i) => {
        const b = readBlobFromCSS(el);
        const anchorEl = el.closest('.glow-anchor');
        const sectionEl = anchorEl ? getGlowTargetSection(anchorEl, groupEl) : null;
        const sectionWidth = sectionEl?.offsetWidth || cssWidth;
        const sectionHeight = sectionEl?.offsetHeight || cssHeight;
        const { top: anchorTop, left: anchorLeft } = anchorEl
          ? getOffsetWithinGroup(anchorEl, groupEl)
          : { top: 0, left: 0 };

        const offsetX = resolveOffset(b.x, b.xIsPx, b.xIsPercent, sectionWidth);
        const offsetY = resolveOffset(b.y, b.yIsPx, b.yIsPercent, sectionHeight);
        const globalX = anchorLeft + offsetX;
        const globalY = anchorTop + offsetY;

        centers[i * 2] = globalX / cssWidth;
        centers[i * 2 + 1] = 1 - globalY / cssHeight;
        colors[i * 3] = b.color[0];
        colors[i * 3 + 1] = b.color[1];
        colors[i * 3 + 2] = b.color[2];
        radii[i] = b.sizeIsPx
          ? (b.size / cssHeight)
          : (b.size * sectionHeight) / cssHeight;
        opacities[i] = b.opacity;
      });
    }

    function resize() {
      if (anchors.length) {
        positionAllAnchors(groupEl, anchors);
      }

      const { width: cssWidth, height: cssHeight } = getGroupCanvasSize(groupEl, layoutState, anchors);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const newWidth = Math.round(cssWidth * dpr);
      // Іноді реальна висота .glow-group трохи більша за виміряну,
      // і тоді canvas лишається "нижче" по Y та з'являється шов/блік знизу.
      // Підтягуємо canvas по висоті до реальної висоти контейнера.
      const groupRect = groupEl.getBoundingClientRect();
      const fixedCssHeight = Math.max(cssHeight, groupRect.height || cssHeight);
      const newHeight = Math.round(fixedCssHeight * dpr);

      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${fixedCssHeight}px`;

      if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }

      refreshBlobsFromCSS(cssWidth, fixedCssHeight);
      bgColor = readBgColor(groupEl);
    }

    let resizeTimer;
    let resizeRaf = 0;

    function scheduleResize() {
      clearTimeout(resizeTimer);
      cancelAnimationFrame(resizeRaf);

      resizeTimer = setTimeout(() => {
        resizeRaf = requestAnimationFrame(() => {
          resizeRaf = requestAnimationFrame(resize);
        });
      }, 120);
    }

    window.addEventListener('resize', scheduleResize);

    new ResizeObserver(scheduleResize).observe(groupEl);

    resize();

    function render(time) {
      gl.uniform2f(resLoc, canvas.width, canvas.height);
      gl.uniform1f(timeLoc, time * 0.001);
      gl.uniform1i(countLoc, activeBlobs.length);
      gl.uniform2fv(centersLoc, centers);
      gl.uniform3fv(colorsLoc, colors);
      gl.uniform1fv(radiiLoc, radii);
      gl.uniform1fv(opacitiesLoc, opacities);
      gl.uniform3f(bgLoc, bgColor[0], bgColor[1], bgColor[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  }

  function init() {
    document.querySelectorAll('.glow-group').forEach(initGroup);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
