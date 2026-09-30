import * as THREE from 'three';

export function workLightUniforms() {
  return {
    uWorkPosition: { value: [new THREE.Vector3(), new THREE.Vector3()] },
    uWorkDirection: { value: [new THREE.Vector3(), new THREE.Vector3()] },
    uWorkCone: { value: [new THREE.Vector2(), new THREE.Vector2()] },
    uWorkPower: { value: [0, 0] },
  };
}

export function updateWorkLightWater(uniforms, lights) {
  for (let i = 0; i < 2; i++) {
    const light = lights[i];
    light.getWorldPosition(uniforms.uWorkPosition.value[i]);
    light.target.getWorldPosition(uniforms.uWorkDirection.value[i]);
    uniforms.uWorkDirection.value[i].sub(uniforms.uWorkPosition.value[i]).normalize();
    uniforms.uWorkCone.value[i].set(
      Math.cos(light.angle),
      Math.cos(light.angle * (1 - light.penumbra)),
    );
    uniforms.uWorkPower.value[i] = light.intensity;
  }
}

// The same two physical lamps that illuminate timber, plants and crew also
// light the water. No overlay/decal: cone incidence, distance, Fresnel and the
// animated surface normal determine each fragment's reflected radiance.
export const workLightFragment = /* glsl */ `
  uniform vec3 uWorkPosition[2];
  uniform vec3 uWorkDirection[2];
  uniform vec2 uWorkCone[2];
  uniform float uWorkPower[2];
  vec3 workLightWater(vec3 point, vec3 normal, vec3 view, float rough, float ripple) {
    vec3 radiance = vec3(0.0);
    for(int i=0;i<2;i++) {
      if(uWorkPower[i] <= 0.0) continue;
      vec3 delta = uWorkPosition[i]-point;
      float distance2 = dot(delta,delta);
      vec3 incoming = normalize(delta);
      float cone = smoothstep(uWorkCone[i].x,uWorkCone[i].y,
        dot(-incoming,uWorkDirection[i]));
      float attenuation = cone * uWorkPower[i] / max(1.0,distance2);
      attenuation *= pow(clamp(1.0-pow(sqrt(distance2)/40.0,4.0),0.0,1.0),2.0);
      float nl = max(dot(normal,incoming),0.0);
      float nv = max(dot(normal,view),.01);
      vec3 halfway = normalize(incoming+view);
      float nh = max(dot(normal,halfway),0.0);
      float vh = max(dot(view,halfway),0.0);
      float a2 = pow(.17+rough*.16,4.0);
      float denominator = nh*nh*(a2-1.0)+1.0;
      float distribution = a2 / max(.00001,3.14159*denominator*denominator);
      float fresnel = .02+.98*pow(1.0-vh,5.0);
      float k = .16;
      float masking = nl/(nl*(1.0-k)+k) * nv/(nv*(1.0-k)+k);
      float specular = distribution*fresnel*masking/max(.01,4.0*nl*nv);
      // Suspended green coastal particles supply restrained diffuse return;
      // warm-white reflections break across moving wave facets.
      vec3 scattering = vec3(.0025,.006,.0045)*(.25+.75*ripple);
      radiance += attenuation*nl*(scattering + vec3(1.0,.97,.89)*specular*.5);
      // A very thin humid boundary layer catches light from the lamp all
      // the way out to the sea, rather than drawing a disconnected pool.
      for(int j=0;j<4;j++) {
        vec3 samplePoint = point + view*(float(j)+.5)*.9;
        vec3 ray = samplePoint-uWorkPosition[i];
        float volumeCone = smoothstep(uWorkCone[i].x,uWorkCone[i].y,
          dot(normalize(ray),uWorkDirection[i]));
        float falloff = volumeCone*uWorkPower[i]/max(1.0,dot(ray,ray));
        radiance += vec3(.8,.9,.86)*falloff*.0005;
      }

    }
    return radiance;
  }
`;
