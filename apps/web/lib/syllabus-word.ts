import 'server-only';
import WordExtractor from 'word-extractor';
import { fromBuffer } from 'yauzl';
import { SyllabusError } from './syllabus-check';

// Validate actual inflated sizes, not just archive metadata, before Word parsing.
export function validateWordArchive(buffer: Buffer): Promise<void> {
  return new Promise((resolve,reject)=>{
    fromBuffer(buffer,{lazyEntries:true,validateEntrySizes:true},(error,zip)=>{
      if(error||!zip){reject(new SyllabusError('This Word document could not be read. Try saving it again as .docx.'));return;}
      let bytes=0,entries=0,hasDocument=false,settled=false;
      const fail=()=>{if(!settled){settled=true;zip.close();reject(new SyllabusError('This Word document is invalid or too large when unpacked. Upload a simpler document.'));}};
      zip.on('error',fail);
      zip.on('entry',entry=>{
        if(++entries>1000||entry.uncompressedSize>10*1024*1024||(entry.generalPurposeBitFlag&1)||/vbaProject\.bin$/i.test(entry.fileName)){fail();return;}
        if(entry.fileName==='word/document.xml')hasDocument=true;
        if(entry.fileName.endsWith('/')){zip.readEntry();return;}
        zip.openReadStream(entry,(error,stream)=>{
          if(error||!stream){fail();return;}
          stream.on('error',fail);
          stream.on('data',chunk=>{bytes+=chunk.length;if(bytes>10*1024*1024){stream.destroy();fail();}});
          stream.on('end',()=>{if(!settled)zip.readEntry();});
        });
      });
      zip.on('end',()=>{if(!settled){settled=true;zip.close();if(hasDocument)resolve();else reject(new SyllabusError('This is not a Word document. Upload a .doc or .docx syllabus.'));}});
      zip.readEntry();
    });
  });
}

export async function extractWord(bytes: Uint8Array, modern: boolean) {
  const buffer=Buffer.from(bytes);
  if(modern){
    if(buffer.subarray(0,4).toString('hex')!=='504b0304')throw new SyllabusError('This file is not a valid .docx document.');
    await validateWordArchive(buffer);
  }else if(buffer.subarray(0,8).toString('hex')!=='d0cf11e0a1b11ae1')throw new SyllabusError('This file is not a supported Word .doc document. Save it as .docx or PDF and try again.');
  try{
    const document=await new WordExtractor().extract(buffer);
    return [document.getHeaders({includeFooters:false}),document.getBody(),document.getFootnotes(),document.getEndnotes(),document.getTextboxes(),document.getFooters()].filter(Boolean).join('\n');
  }catch{throw new SyllabusError('This Word document could not be read. Try an unencrypted .docx or PDF copy.');}
}
