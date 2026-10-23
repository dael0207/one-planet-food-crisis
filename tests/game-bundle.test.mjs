import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('published classic bundle and every current source match the checked build receipt',async()=>{
 const receipt=JSON.parse(await readFile(new URL('build/game-bundle.json',root),'utf8'));
 assert.equal(receipt.compiler,'esbuild');assert.equal(receipt.version,'0.28.2');assert.equal(receipt.format,'iife');
 assert.equal(receipt.target,'es2022');assert.equal(receipt.output.file,'dist/game.bundle.js');
 const files=(await readdir(new URL('dist/',root))).filter(file=>file.endsWith('.mjs')).map(file=>'dist/'+file).sort();
 assert.deepEqual(receipt.inputs.map(input=>input.file).sort(),files);
 assert.equal(receipt.sourceEncoding,'utf8-lf');
 for(const input of receipt.inputs){
  const source=(await readFile(new URL(input.file,root),'utf8')).replaceAll('\r\n','\n');
  assert.equal(hash(source),input.sha256,`${input.file}: 게임 묶음을 다시 빌드하세요`);
 }
 const bytes=await readFile(new URL(receipt.output.file,root));
 assert.equal(bytes.length,receipt.output.bytes);assert.equal(hash(bytes),receipt.output.sha256);
 assert.doesNotThrow(()=>new vm.Script(bytes.toString('utf8'),{filename:receipt.output.file}));
});
