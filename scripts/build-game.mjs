import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url);
const option=process.argv.indexOf('--esbuild-api');
const apiPath=option>=0?process.argv[option+1]:process.env.ESBUILD_API;
let compiler;
try { compiler=require(apiPath?path.resolve(apiPath):'esbuild'); }
catch { throw new Error('기존 esbuild 0.28.2의 lib/main.js 경로를 --esbuild-api 또는 ESBUILD_API로 지정하세요. 자동 설치는 하지 않습니다.'); }
if(compiler.version!=='0.28.2')throw new Error('재현 가능한 빌드에는 esbuild 0.28.2가 필요합니다.');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const result=await compiler.build({
 absWorkingDir:root,entryPoints:['dist/app.mjs'],outfile:'dist/game.bundle.js',
 bundle:true,format:'iife',platform:'browser',target:'es2022',charset:'utf8',
 minifyWhitespace:true,minifySyntax:true,minifyIdentifiers:false,
 legalComments:'none',metafile:true,write:false,logLevel:'silent'
});
if(result.outputFiles.length!==1||Object.values(result.metafile.outputs).some(output=>output.imports.length))throw new Error('게임은 외부 모듈 요청 없는 단일 파일이어야 합니다.');
const inputs=await Promise.all(Object.keys(result.metafile.inputs).sort().map(async name=>{
 const file=name.replace(/\?v=\d+$/,'');
 if(!/^dist\/[a-z0-9-]+\.mjs$/.test(file))throw new Error(`예상하지 않은 입력: ${name}`);
 const source=(await readFile(path.join(root,file),'utf8')).replaceAll('\r\n','\n');
 return {file,sha256:hash(source)};
}));
const bytes=result.outputFiles[0].contents;
await writeFile(path.join(root,'dist/game.bundle.js'),bytes);
await mkdir(path.join(root,'build'),{recursive:true});
await writeFile(path.join(root,'build/game-bundle.json'),JSON.stringify({
 compiler:'esbuild',version:compiler.version,format:'iife',target:'es2022',sourceEncoding:'utf8-lf',
 output:{file:'dist/game.bundle.js',bytes:bytes.length,sha256:hash(bytes)},inputs
},null,2)+'\n');
console.log(`단일 게임 파일: ${bytes.length} bytes, ${inputs.length}개 모듈`);
