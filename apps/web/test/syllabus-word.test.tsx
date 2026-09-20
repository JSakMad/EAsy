// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { deflateRawSync } from 'node:zlib';
import { expect, it, vi } from 'vitest';
import { extractSyllabus } from '../lib/syllabus-file';
vi.mock('server-only',()=>({}));

function zip(files: Record<string,string>) {
  let offset=0;const locals:Buffer[]=[],central:Buffer[]=[];
  for(const [filename,text] of Object.entries(files)){
    const name=Buffer.from(filename),data=Buffer.from(text),compressed=deflateRawSync(data);
    let crc=0xffffffff;for(const byte of data){crc^=byte;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);
    const index=Buffer.alloc(46);index.writeUInt32LE(0x02014b50);index.writeUInt16LE(20,4);index.writeUInt16LE(20,6);index.writeUInt16LE(8,10);index.writeUInt32LE(crc,16);index.writeUInt32LE(compressed.length,20);index.writeUInt32LE(data.length,24);index.writeUInt16LE(name.length,28);index.writeUInt32LE(offset,42);
    locals.push(local,name,compressed);central.push(index,name);offset+=local.length+name.length+compressed.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return new Uint8Array(Buffer.concat([...locals,directory,end]));
}
const contentTypes='<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';

it('extracts syllabus text from an actual DOCX archive',async()=>{
  const text=['DEMO 101: Creative Problem Solving','Instructor: Avery Rowan','Weekly quizzes are available online through Canvas. Attendance is optional.'];
  const xml='<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+text.map(p=>'<w:p><w:r><w:t>'+p+'</w:t></w:r></w:p>').join('')+'</w:body></w:document>';
  const data=zip({'[Content_Types].xml':contentTypes,'word/document.xml':xml});
  const result=await extractSyllabus(new File([data],'syllabus.docx',{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));
  for(const phrase of text)expect(result.text).toContain(phrase);
});
it('extracts a real legacy .doc document without Office installed',async()=>{
  const bytes=new Uint8Array(await readFile(new URL('./fixtures/word-extractor/sample.doc',import.meta.url)));
  const result=await extractSyllabus(new File([bytes],'syllabus.doc',{type:'application/msword'}));
  expect(result.text.trim().length).toBeGreaterThan(80);
  expect(result.bytes.length).toBe(bytes.length);
});
it('rejects non-Word archives, excessive expansion, and mislabeled documents',async()=>{
  const archives=[zip({'other.xml':'not a Word document'}),zip({'word/document.xml':'x'.repeat(10*1024*1024+1)})];
  for(const data of archives)await expect(extractSyllabus(new File([data],'syllabus.docx'))).rejects.toThrow();
  await expect(extractSyllabus(new File(['not a Word document'],'syllabus.doc'))).rejects.toThrow('not a supported Word');
});
