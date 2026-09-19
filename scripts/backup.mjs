import {spawn} from 'node:child_process';
import {createReadStream,createWriteStream} from 'node:fs';
import {mkdir,rename,stat,writeFile} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const dir=resolve(root,'data/backups');
await mkdir(dir,{recursive:true,mode:0o700});
const file=resolve(dir,`easy-${new Date().toISOString().replace(/[:.]/g,'-')}.dump`);
const partial=`${file}.partial`;
function docker(args){
  const child=spawn('docker',['compose','exec','-T','postgres',...args],{cwd:root,stdio:['pipe','pipe','inherit']});
  const done=new Promise((yes,no)=>{child.on('error',no);child.on('close',code=>code===0?yes():no(new Error(`Docker exited ${code}; backup was not marked complete.`)))});
  return {child,done};
}
const dump=docker(['pg_dump','-U','postgres','-d','easy_a_finder','--format=custom','--no-owner','--no-acl']);
dump.child.stdin.end();
await Promise.all([pipeline(dump.child.stdout,createWriteStream(partial,{flags:'wx',mode:0o600})),dump.done]);
const check=docker(['pg_restore','--list']);
check.child.stdout.resume();
await Promise.all([pipeline(createReadStream(partial),check.child.stdin),check.done]);
await rename(partial,file);
const hash=createHash('sha256');
for await(const chunk of createReadStream(file)) hash.update(chunk);
await writeFile(`${file}.json`,JSON.stringify({bytes:(await stat(file)).size,sha256:hash.digest('hex'),archiveIndexVerified:true},null,2),{mode:0o600,flag:'wx'});
console.log(`Private backup saved and archive index verified: ${file}`);
console.log('This backs up the local Compose database. Keep backups private; they include raw reviews.');
