/** Apply after AnimationMixer.update(dt). Units and travel come from the GLB itself. */
export function createButtonInteraction(gltf) {
  const bones = new Map();
  gltf.scene.traverse(object => {
    if (object.isBone && /^BTN_(Melody|Bass)_\d+$/.test(object.name)) {
      bones.set(object.name, { bone: object, rest: object.position.clone(), amount: 0, target: 0 });
    }
  });
  const travel = new Map();
  for (const clip of gltf.animations) {
    for (const track of clip.tracks) {
      const match = track.name.match(/(BTN_(Melody|Bass)_\d+)\.position$/);
      if (!match || !bones.has(match[1])) continue;
      const rest = bones.get(match[1]).rest.clone().fromArray(track.values, 0);
      let best = rest.clone().set(0, 0, 0);
      for (let i = 0; i < track.values.length; i += 3) {
        const delta = rest.clone().fromArray(track.values, i).sub(rest);
        if (delta.lengthSq() > best.lengthSq()) best.copy(delta);
      }
      if (best.length() > 0.001) travel.set(match[2], best);
    }
  }
  if (bones.size !== 43 || !travel.has('Melody') || !travel.has('Bass')) {
    throw new Error('Expected 31 melody / 12 bass bones and calibrated press tracks.');
  }
  const resolve = name => {
    const key = name.startsWith('BTN_') ? name : `BTN_${name}`;
    const state = bones.get(key);
    if (!state) throw new Error(`Unknown accordion button: ${name}`);
    return state;
  };
  return {
    names: [...bones.keys()],
    press(name) { resolve(name).target = 1; },
    release(name) { resolve(name).target = 0; },
    releaseAll() { for (const state of bones.values()) state.target = 0; },
    update(dt) {
      for (const [name, state] of bones) {
        if (state.target === 0 && state.amount === 0) continue;
        const tau = state.target ? 0.026 : 0.040;
        state.amount += (state.target - state.amount) * (1 - Math.exp(-Math.max(0, dt) / tau));
        if (state.target === 0 && state.amount < 0.0001) state.amount = 0;
        const kind = name.includes('Melody') ? 'Melody' : 'Bass';
        state.bone.position.copy(state.rest).addScaledVector(travel.get(kind), state.amount);
      }
    },
  };
}
