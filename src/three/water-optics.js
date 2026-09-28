// A short coastal sight column: clear body contrast near the surface, green
// backscatter and red absorption below it. Rough/rainy water shortens the view.
export function coastalDaylight(minute) {
  const clock = ((minute % 1440) + 1440) % 1440;
  return Math.max(0.055, Math.sin(((clock - 340) / 870) * Math.PI));
}

export function waterTurbidity(world) {
  return 1 + Math.min(0.3, (world.weather?.rain || 0) * 0.15 + (world.weather?.wave || 0) * 0.055);
}
export function submergedContrast(depth, turbidity = 1) {
  const d = Math.max(0, depth) * turbidity;
  const t = Math.min(1, Math.max(0, (d - 1.8) / 3.2));
  return Math.exp(-d * 0.11) * (1 - t * t * (3 - 2 * t));
}

export function waterColumnMaterials(source) {
  const uniforms = {
    uColumnTime: { value: 0 },
    uColumnTurbidity: { value: 1 },
    uColumnLight: { value: 1 },
  };
  const cache = new Map();
  const materials = Object.fromEntries(
    Object.entries(source).map(([key, original]) => {
      if (!cache.has(original)) {
        const material = original.clone();
        material.transparent = true;
        material.depthWrite = false;
        material.onBeforeCompile = (shader) => {
          Object.assign(shader.uniforms, uniforms);
          shader.vertexShader = 'varying vec3 vColumnPosition;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            '#include <project_vertex>',
            '#include <project_vertex>\nvec4 columnLocal = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\ncolumnLocal = instanceMatrix * columnLocal;\n#endif\nvColumnPosition = (modelMatrix * columnLocal).xyz;',
          );
          shader.fragmentShader =
            `varying vec3 vColumnPosition;
          uniform float uColumnTime;
          uniform float uColumnTurbidity;
          uniform float uColumnLight;\n` + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <opaque_fragment>',
            `
          float columnDepth = max(0.0, -vColumnPosition.y) * uColumnTurbidity;
          float ripple = sin(vColumnPosition.x*5.0 + uColumnTime*1.8)
            * sin(vColumnPosition.z*4.1 - uColumnTime*1.4);
          float transmission = exp(-columnDepth*.11)
            * (1.0-smoothstep(1.8,5.0,columnDepth));
          vec3 absorption = exp(-columnDepth*vec3(.62,.085,.29));
          vec3 backscatter = vec3(.024,.075,.052)*(.2+.8*uColumnLight);
          outgoingLight = mix(outgoingLight * absorption, backscatter,
            1.0-exp(-columnDepth*.18));
          outgoingLight += vec3(.022,.033,.025)*ripple*min(.4,columnDepth*.18)*transmission;
          diffuseColor.a *= transmission;
          if (diffuseColor.a < .005) discard;
          #include <opaque_fragment>
        `,
          );
        };
        material.customProgramCacheKey = () => 'bc-water-column-v1';
        cache.set(original, material);
      }
      return [key, cache.get(original)];
    }),
  );
  return {
    materials,
    uniforms,
    dispose: () => {
      for (const m of cache.values()) m.dispose();
    },
  };
}
