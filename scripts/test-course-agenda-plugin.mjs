import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
// Reuse an available PHP WASM installation; no package download is performed.
const runtimeDir=process.argv[2];if(!runtimeDir)throw new Error('Pass the directory containing @php-wasm/universal and @php-wasm/node');
const {PHP}=await import(pathToFileURL(path.resolve(runtimeDir,'@php-wasm/universal/index.js')));
const {loadNodeRuntime}=await import(pathToFileURL(path.resolve(runtimeDir,'@php-wasm/node/index.js')));
for(const version of ['7.4','8.3']){
 const php=new PHP(await loadNodeRuntime(version,{emscriptenOptions:{processId:1}}));
 try{
  php.writeFile('/plugin.php',fs.readFileSync('integrations/heftruckopleiding-keuringsagenda/heftruckopleiding-keuringsagenda.php'));
  php.writeFile('/test.php',fs.readFileSync('tests/course-agenda-plugin.php'));
  const result=await php.run({code:"<?php token_get_all(file_get_contents('/plugin.php'),TOKEN_PARSE);require '/test.php';"});
  if(result.errors||!result.text.includes('PASS:'))throw new Error(result.errors+result.text);
  console.log('PHP '+version+': '+result.text.trim());
 }finally{php.exit();}
}
