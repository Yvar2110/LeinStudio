import * as THREE from "three";
import { MAX_DESIGNS } from "../types";

export interface DesignShaderSlot {
  texture: THREE.Texture;
  inverseMatrix: THREE.Matrix4;
  size: THREE.Vector2;
  depth: number;
  localNormal: THREE.Vector3;
}

const DUMMY_TEXTURE = (() => {
  const data = new Uint8Array([0, 0, 0, 0]);
  const tex = new THREE.DataTexture(data, 1, 1);
  tex.needsUpdate = true;
  return tex;
})();

function buildDesignBlendGLSL(count: number): string {
  const blocks: string[] = [];
  for (let i = 0; i < count; i++) {
    blocks.push(`
      if (designActive${i} > 0.5) {
        vec3 lp${i} = (designMatrix${i} * vec4(vDesignObjPos, 1.0)).xyz;
        vec2 duv${i} = lp${i}.xy / designSize${i} + 0.5;
        if (
          abs(lp${i}.z) < designDepth${i}
          && duv${i}.x >= 0.0 && duv${i}.x <= 1.0
          && duv${i}.y >= 0.0 && duv${i}.y <= 1.0
          && dot(normalize(vDesignObjNormal), designNormal${i}) > 0.0
        ) {
          vec4 dc${i} = texture2D(designMap${i}, duv${i});
          if (dc${i}.a > 0.02) {
            diffuseColor.rgb = mix(diffuseColor.rgb, dc${i}.rgb, dc${i}.a);
          }
        }
      }`);
  }
  return blocks.join("\n");
}

function buildUniformDecls(count: number): string {
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    lines.push(`uniform sampler2D designMap${i};`);
    lines.push(`uniform mat4 designMatrix${i};`);
    lines.push(`uniform vec2 designSize${i};`);
    lines.push(`uniform float designDepth${i};`);
    lines.push(`uniform vec3 designNormal${i};`);
    lines.push(`uniform float designActive${i};`);
  }
  return lines.join("\n");
}

function initUniforms(shader: THREE.WebGLProgramParametersWithUniforms): void {
  for (let i = 0; i < MAX_DESIGNS; i++) {
    shader.uniforms[`designMap${i}`] = { value: DUMMY_TEXTURE };
    shader.uniforms[`designMatrix${i}`] = { value: new THREE.Matrix4() };
    shader.uniforms[`designSize${i}`] = { value: new THREE.Vector2(1, 1) };
    shader.uniforms[`designDepth${i}`] = { value: 0.06 };
    shader.uniforms[`designNormal${i}`] = { value: new THREE.Vector3(0, 0, 1) };
    shader.uniforms[`designActive${i}`] = { value: 0 };
  }
}

function applySlots(
  shader: THREE.WebGLProgramParametersWithUniforms,
  slots: DesignShaderSlot[]
): void {
  for (let i = 0; i < MAX_DESIGNS; i++) {
    const slot = slots[i];
    if (slot) {
      shader.uniforms[`designMap${i}`].value = slot.texture;
      shader.uniforms[`designMatrix${i}`].value.copy(slot.inverseMatrix);
      shader.uniforms[`designSize${i}`].value.copy(slot.size);
      shader.uniforms[`designDepth${i}`].value = slot.depth;
      shader.uniforms[`designNormal${i}`].value.copy(slot.localNormal);
      shader.uniforms[`designActive${i}`].value = 1;
    } else {
      shader.uniforms[`designMap${i}`].value = DUMMY_TEXTURE;
      shader.uniforms[`designActive${i}`].value = 0;
    }
  }
}

/**
 * Proyecta las imágenes directamente sobre el material de la tela (en el espacio
 * de objeto de la malla, que es constante al rotar) para que se vean "impresas"
 * y no como un plano flotante.
 */
export class TShirtDesignShader {
  private slots: DesignShaderSlot[] = [];
  private compiledShader: THREE.WebGLProgramParametersWithUniforms | null = null;

  install(material: THREE.MeshPhysicalMaterial): void {
    if (material.userData.designShaderInstalled) return;

    material.customProgramCacheKey = () => "lein-shirt-designs-v5";
    const self = this;

    material.onBeforeCompile = (shader) => {
      initUniforms(shader);

      shader.vertexShader = shader.vertexShader.replace(
        "void main() {",
        `varying vec3 vDesignObjPos;
varying vec3 vDesignObjNormal;
void main() {`
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
vDesignObjNormal = objectNormal;`
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vDesignObjPos = transformed;`
      );

      const uniformDecls = buildUniformDecls(MAX_DESIGNS);
      const blendCode = buildDesignBlendGLSL(MAX_DESIGNS);

      shader.fragmentShader = shader.fragmentShader.replace(
        "void main() {",
        `varying vec3 vDesignObjPos;
varying vec3 vDesignObjNormal;
${uniformDecls}
void main() {`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
${blendCode}`
      );

      self.compiledShader = shader;
      applySlots(shader, self.slots);
    };

    material.userData.designShaderInstalled = true;
    material.needsUpdate = true;
  }

  uninstall(material: THREE.MeshPhysicalMaterial): void {
    if (!material.userData.designShaderInstalled) return;

    material.onBeforeCompile = () => undefined;
    material.customProgramCacheKey = () => "";
    delete material.userData.designShaderInstalled;
    material.needsUpdate = true;

    this.compiledShader = null;
    this.slots = [];
  }

  ensureForDesignCount(material: THREE.MeshPhysicalMaterial, count: number): void {
    if (count > 0) {
      this.install(material);
    } else {
      this.uninstall(material);
    }
  }

  setSlots(slots: DesignShaderSlot[]): void {
    this.slots = slots;
    if (this.compiledShader) {
      applySlots(this.compiledShader, slots);
    }
  }
}
