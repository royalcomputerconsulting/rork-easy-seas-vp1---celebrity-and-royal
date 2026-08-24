import { extractCertificatePdfText } from '@/lib/certificates/certificatePdfPipeline';
import { parseRoyalCruiseInvoiceText, type ParsedCruiseInvoice } from './cruiseInvoiceParser';

// Pure JavaScript MD5; no Node crypto and no backend dependency.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const forge = require('node-forge') as { md: { md5: { create(): { update(value: string, encoding?: string): void; digest(): { getBytes(): string } } } } };
const PAD = [0x28,0xbf,0x4e,0x5e,0x4e,0x75,0x8a,0x41,0x64,0x00,0x4e,0x56,0xff,0xfa,0x01,0x08,0x2e,0x2e,0x00,0xb6,0xd0,0x68,0x3e,0x80,0x2f,0x0c,0xa9,0xfe,0x64,0x53,0x69,0x7a];
const latin1 = (data: Uint8Array) => { let out=''; for(let i=0;i<data.length;i+=0x4000) out+=String.fromCharCode(...data.subarray(i,Math.min(i+0x4000,data.length))); return out; };
const toBytes = (value:string) => Uint8Array.from(value, character => character.charCodeAt(0)&255);
const fromHex = (value:string) => Uint8Array.from(value.match(/.{2}/g)??[], pair=>Number.parseInt(pair,16));
const md5 = (data:Uint8Array) => { const digest=forge.md.md5.create(); digest.update(latin1(data),'raw'); return toBytes(digest.digest().getBytes()); };

function rc4(data:Uint8Array,key:Uint8Array){const state=Uint8Array.from({length:256},(_,i)=>i);let j=0;for(let i=0;i<256;i++){j=(j+state[i]+key[i%key.length])&255;[state[i],state[j]]=[state[j],state[i]];}const out=new Uint8Array(data.length);let i=0;j=0;for(let n=0;n<data.length;n++){i=(i+1)&255;j=(j+state[i])&255;[state[i],state[j]]=[state[j],state[i]];out[n]=data[n]^state[(state[i]+state[j])&255];}return out;}

/** Decrypts the passwordless Standard R2/RC4 form Royal uses for downloadable receipts. */
export function decryptRoyalReceiptPdf(input:Uint8Array):Uint8Array{
  const source=latin1(input),ref=source.match(/\/Encrypt\s+(\d+)\s+(\d+)\s+R/);if(!ref)return input;
  const dictionary=source.match(new RegExp(`${ref[1]}\\s+${ref[2]}\\s+obj([\\s\\S]*?)endobj`))?.[1]??'';
  const revision=Number(dictionary.match(/\/R\s+(\d+)/)?.[1]??0),version=Number(dictionary.match(/\/V\s+(\d+)/)?.[1]??0);
  if(revision!==2||version!==1)throw new Error(`This Royal PDF uses unsupported encryption (R${revision}/V${version}). Re-save it as a PDF, then import the saved copy.`);
  const owner=fromHex(dictionary.match(/\/O\s*<([0-9a-f]+)>/i)?.[1]??''),user=fromHex(dictionary.match(/\/U\s*<([0-9a-f]+)>/i)?.[1]??''),fileId=fromHex(source.match(/\/ID\s*\[\s*<([0-9a-f]+)>/i)?.[1]??'');
  const permissions=Number(dictionary.match(/\/P\s+(-?\d+)/)?.[1]??0)|0;if(owner.length!==32||user.length!==32||!fileId.length)throw new Error('The encrypted Royal PDF security dictionary is incomplete.');
  const permissionBytes=Uint8Array.from([permissions&255,(permissions>>>8)&255,(permissions>>>16)&255,(permissions>>>24)&255]);
  const material=new Uint8Array(68+fileId.length);material.set(PAD);material.set(owner,32);material.set(permissionBytes,64);material.set(fileId,68);const fileKey=md5(material).slice(0,5);
  if(!rc4(Uint8Array.from(PAD),fileKey).every((value,index)=>value===user[index]))throw new Error('This Royal receipt requires a PDF password. Open it and save an unencrypted copy before importing.');
  const output=input.slice();
  for(const match of source.matchAll(/(\d+)\s+(\d+)\s+obj\b/g)){
    const objectNumber=Number(match[1]),generation=Number(match[2]);if(match[1]===ref[1]&&match[2]===ref[2])continue;
    const objectStart=match.index??0,objectEnd=source.indexOf('endobj',objectStart);if(objectEnd<0)continue;
    const streamPattern=/stream\r?\n/g;streamPattern.lastIndex=objectStart;const stream=streamPattern.exec(source);if(!stream||stream.index>objectEnd)continue;
    const start=stream.index+stream[0].length;let end=source.indexOf('\nendstream',start);if(end<0||end>objectEnd)end=source.indexOf('\rendstream',start);if(end<0||end>objectEnd)continue;
    const keyMaterial=Uint8Array.from([...fileKey,objectNumber&255,(objectNumber>>>8)&255,(objectNumber>>>16)&255,generation&255,(generation>>>8)&255]);
    output.set(rc4(input.subarray(start,end),md5(keyMaterial).slice(0,10)),start);
  }
  return output;
}

export function extractRoyalReceiptPdfText(input:Uint8Array):string{const text=extractCertificatePdfText(decryptRoyalReceiptPdf(input));if(!/CRUISE\s*(?:VACATION\s*)?RECEIPT|Reservation\s+ID/i.test(text))throw new Error('This PDF did not contain readable Royal Cruise Vacation Receipt text.');return text;}
export function parseRoyalCruiseInvoicePdf(input:Uint8Array):ParsedCruiseInvoice{return parseRoyalCruiseInvoiceText(extractRoyalReceiptPdfText(input));}
