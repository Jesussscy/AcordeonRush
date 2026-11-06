import fs from 'node:fs';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Parse a real GLB in Node. Texture references are stripped (no DOM image decoder),
 * geometry, skin, bones and animation clips are kept intact.
 */
export async function loadGlbWithoutTextures(path: string): Promise<GLTF> {
  const bytes = fs.readFileSync(path);
  const jsonSize = bytes.readUInt32LE(12);
  const doc = JSON.parse(bytes.subarray(20, 20 + jsonSize).toString('utf8'));
  for (const material of doc.materials ?? []) {
    for (const key of ['normalTexture', 'occlusionTexture', 'emissiveTexture']) delete material[key];
    if (material.pbrMetallicRoughness) {
      delete material.pbrMetallicRoughness.baseColorTexture;
      delete material.pbrMetallicRoughness.metallicRoughnessTexture;
    }
  }
  const json = Buffer.from(JSON.stringify(doc));
  const padded = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]);
  const tail = bytes.subarray(20 + jsonSize);
  const glb = Buffer.alloc(20 + padded.length + tail.length);
  glb.writeUInt32LE(0x46546c67, 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(padded.length, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(glb, 20);
  tail.copy(glb, 20 + padded.length);
  const buffer = glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength) as ArrayBuffer;
  return new GLTFLoader().parseAsync(buffer, '');
}

/** Read only the JSON chunk of a GLB (fast metadata checks). */
export function readGlbJson(path: string) {
  const bytes = fs.readFileSync(path);
  if (bytes.toString('utf8', 0, 4) !== 'glTF') throw new Error(`${path} is not a GLB`);
  return JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
}
