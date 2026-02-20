/**
 * WebGL-based image adjustment pipeline. Same math as adjustLogic, runs on GPU.
 */
import type { AdjustParams } from './adjustParams'

const VERTEX_SHADER = `#version 100
attribute vec2 aPosition;
varying vec2 vTexCoord;
void main() {
  vec2 uv = aPosition * 0.5 + 0.5;
  vTexCoord = vec2(uv.x, 1.0 - uv.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `#version 100
precision mediump float;
varying vec2 vTexCoord;
uniform sampler2D uTexture;

uniform float uExposure;
uniform float uContrast;
uniform float uHighlights;
uniform float uShadows;
uniform float uTemp;
uniform float uTint;
uniform float uSaturation;
uniform float uVibrance;

const float LUM_R = 0.299;
const float LUM_G = 0.587;
const float LUM_B = 0.114;

float luminance(vec3 c) {
  return LUM_R * c.r + LUM_G * c.g + LUM_B * c.b;
}

void main() {
  vec4 tex = texture2D(uTexture, vTexCoord);
  vec3 rgb = tex.rgb;

  float expFactor = pow(2.0, uExposure);
  rgb *= expFactor;

  rgb = (rgb - 0.5) * uContrast + 0.5;

  float L = luminance(rgb);
  float tHigh = max(0.0, (L - 0.5) * 2.0);
  float highLift = 1.0 + uHighlights * 0.4 * (1.0 - tHigh);
  rgb *= highLift;

  float tLow = max(0.0, (0.5 - L) * 2.0);
  float shadowLift = 1.0 + uShadows * 0.4 * (1.0 - tLow);
  rgb *= shadowLift;

  rgb.r += uTemp * 0.2;
  rgb.b -= uTemp * 0.2;
  rgb.g -= uTint * 0.2;

  float L2 = luminance(rgb);
  rgb = L2 + (rgb - L2) * uSaturation;

  float sat = max(max(abs(rgb.r - L2), abs(rgb.g - L2)), abs(rgb.b - L2));
  float vib = 1.0 + (uVibrance - 1.0) * (1.0 - sat);
  rgb = L2 + (rgb - L2) * vib;

  rgb = clamp(rgb, 0.0, 1.0);
  gl_FragColor = vec4(rgb, tex.a);
}
`

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function createProgram(
  gl: WebGLRenderingContext,
  vs: WebGLShader,
  fs: WebGLShader,
): WebGLProgram | null {
  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }
  return program
}

const QUAD_POSITIONS = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])

export interface AdjustRenderer {
  setImage(image: HTMLImageElement | null): void
  setParams(params: AdjustParams): void
  setSize(width: number, height: number): void
  render(): void
  destroy(): void
  canvas: HTMLCanvasElement
}

export function createAdjustRenderer(canvas: HTMLCanvasElement): AdjustRenderer | null {
  const ctx = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true })
  if (!ctx) return null
  const gl: WebGLRenderingContext = ctx

  const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  if (!vs || !fs) {
    gl.deleteShader(vs!)
    gl.deleteShader(fs!)
    return null
  }

  const program = createProgram(gl, vs, fs)
  if (!program) {
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    return null
  }

  gl.deleteShader(vs)
  gl.deleteShader(fs)

  const positionLoc = gl.getAttribLocation(program, 'aPosition')
  const textureLoc = gl.getUniformLocation(program, 'uTexture')
  const exposureLoc = gl.getUniformLocation(program, 'uExposure')
  const contrastLoc = gl.getUniformLocation(program, 'uContrast')
  const highlightsLoc = gl.getUniformLocation(program, 'uHighlights')
  const shadowsLoc = gl.getUniformLocation(program, 'uShadows')
  const tempLoc = gl.getUniformLocation(program, 'uTemp')
  const tintLoc = gl.getUniformLocation(program, 'uTint')
  const saturationLoc = gl.getUniformLocation(program, 'uSaturation')
  const vibranceLoc = gl.getUniformLocation(program, 'uVibrance')

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, QUAD_POSITIONS, gl.STATIC_DRAW)

  let texture: WebGLTexture | null = null
  let currentImage: HTMLImageElement | null = null
  let lastParams: AdjustParams | null = null

  function uploadTexture(img: HTMLImageElement): void {
    if (!texture) {
      texture = gl.createTexture()
    }
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    currentImage = img
  }

  const renderer: AdjustRenderer = {
    canvas,

    setImage(image: HTMLImageElement | null): void {
      if (image === currentImage) return
      currentImage = image
      if (image && image.complete && image.naturalWidth > 0) {
        uploadTexture(image)
      }
    },

    setParams(params: AdjustParams): void {
      lastParams = params
    },

    setSize(width: number, height: number): void {
      const dpr = window.devicePixelRatio || 1
      const w = Math.round(width * dpr)
      const h = Math.round(height * dpr)
      if (canvas.width === w && canvas.height === h) return
      canvas.width = w
      canvas.height = h
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      gl.viewport(0, 0, w, h)
    },

    render(): void {
      if (!currentImage || !currentImage.complete || currentImage.naturalWidth === 0) return
      if (currentImage !== null && !texture) {
        uploadTexture(currentImage)
      }
      if (!texture) return

      const params = lastParams
      if (!params) return

      gl.useProgram(program)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.uniform1i(textureLoc, 0)
      gl.uniform1f(exposureLoc, params.exposure)
      gl.uniform1f(contrastLoc, params.contrast)
      gl.uniform1f(highlightsLoc, params.highlights)
      gl.uniform1f(shadowsLoc, params.shadows)
      gl.uniform1f(tempLoc, params.temp)
      gl.uniform1f(tintLoc, params.tint)
      gl.uniform1f(saturationLoc, params.saturation)
      gl.uniform1f(vibranceLoc, params.vibrance)

      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.enableVertexAttribArray(positionLoc)
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    },

    destroy(): void {
      if (texture) {
        gl.deleteTexture(texture)
        texture = null
      }
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      currentImage = null
      lastParams = null
    },
  }

  return renderer
}
